import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ProjectsContract } from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';

import { type EditorServer, createEditorServer, loadEnv } from '../../src';
import { createLoopbackClient } from '../../src/testing';

/** A stand-in for `nf new`: the files the real one writes that the tutorial keeps. */
const FAKE_NF = `#!/usr/bin/env node
const { appendFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const args = process.argv.slice(2);
if (args[0] !== 'new') process.exit(1);
const name = args[args.indexOf('--path') + 1];
appendFileSync(join(process.cwd(), 'nf-new.log'), name + '\\n');
const root = join(process.cwd(), name);
mkdirSync(join(root, 'src/components'), { recursive: true });
mkdirSync(join(root, 'src/systems'), { recursive: true });
writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'game', devDependencies: { '@nanoforge-dev/core': '^2.0.0', '@nanoforge-dev/ecs': '^2.0.0' } }));
writeFileSync(join(root, 'nanoforge.config.ts'), 'export default { type: "client" };\\n');
writeFileSync(join(root, 'src/main.ts'), 'export const main = async () => {};\\n');
`;

let workspace: string;
let editor: EditorServer;
let client: RpcClient;

beforeAll(() => {
  workspace = mkdtempSync(join(import.meta.dirname, '../.tmp-tutorial-'));
  const cli = join(workspace, 'nf.cjs');
  writeFileSync(cli, FAKE_NF);
  chmodSync(cli, 0o755);
  editor = createEditorServer({
    env: loadEnv(
      {
        NODE_ENV: 'test',
        FS_ROOT: workspace,
        DATA_DIR: join(mkdtempSync(join(tmpdir(), 'nf-data-')), 'editor'),
        NF_CLI_PATH: cli,
        TUTORIAL_DIR: join(import.meta.dirname, '../../../../apps/editor/tutorial'),
      },
      workspace,
    ),
    version: '0.0.0-test',
  });
  client = createLoopbackClient(editor);
});

afterAll(() => {
  client.dispose();
  editor.dispose();
  rmSync(workspace, { recursive: true, force: true });
});

describe('projects.createTutorial', () => {
  it('makes the tutorial project over nf new, trusts and opens it, then reopens it', async () => {
    const api = client.api(ProjectsContract);
    const created = await api.createTutorial({ install: false });
    const root = join(workspace, 'my-first-game');
    expect(created).toMatchObject({ trusted: true });
    expect(existsSync(join(root, 'src/systems/move-2d.system.ts'))).toBe(true);
    expect(readFileSync(join(root, 'src/main.ts'), 'utf8')).toContain('new EditorLibrary()');
    const json = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    expect(json.devDependencies['@nanoforge-dev/editor-lib']).toBe('^2.0.0');
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain('dist/');
    expect(Object.keys(json.devDependencies)).toEqual(
      [...Object.keys(json.devDependencies)].sort(),
    );

    writeFileSync(join(root, 'notes.txt'), 'kept');
    const again = await api.createTutorial({ install: false });
    expect(again.id).toBe(created.id);
    expect(readFileSync(join(root, 'notes.txt'), 'utf8')).toBe('kept');
  });

  it('refuses a folder of that name that is not the tutorial, even a NanoForge project', async () => {
    mkdirSync(join(workspace, 'other-game'));
    await expect(
      client.api(ProjectsContract).createTutorial({ name: 'other-game', install: false }),
    ).rejects.toThrow(/not the tutorial's project/);
    writeFileSync(join(workspace, 'other-game/nanoforge.config.ts'), 'export default {};\n');
    await expect(
      client.api(ProjectsContract).createTutorial({ name: 'other-game', install: false }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('makes the project once when asked twice at the same time', async () => {
    const api = client.api(ProjectsContract);
    const [first, second] = await Promise.all([
      api.createTutorial({ name: 'race-game', install: false }),
      api.createTutorial({ name: 'race-game', install: false }),
    ]);
    expect(second.id).toBe(first.id);
    const made = readFileSync(join(workspace, 'nf-new.log'), 'utf8')
      .split('\n')
      .filter((name) => name === 'race-game');
    expect(made).toHaveLength(1);
  });
});
