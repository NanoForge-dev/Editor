import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PluginsContract, ProjectsContract, RuntimeContract } from '@nanoforge-dev/editor-protocol';

import { loadEnv } from '../../src/env/load-env';
import { createEditorServer } from '../../src/server/create-editor-server';
import type { EditorServer } from '../../src/server/editor-server.type';
import { createLoopbackClient } from '../../src/testing';

const FIXTURES = join(import.meta.dirname, '../fixtures');

let workspace: string;
let dataDir: string;
let marker: string;
const servers: EditorServer[] = [];

beforeEach(() => {
  workspace = mkdtempSync(join(import.meta.dirname, '../.tmp-trust-'));
  dataDir = join(mkdtempSync(join(tmpdir(), 'nf-data-')), 'editor');
  cpSync(join(FIXTURES, 'pong-network'), join(workspace, 'pong'), { recursive: true });
  marker = join(workspace, 'config-ran');
  appendFileSync(
    join(workspace, 'pong/nanoforge.config.ts'),
    `\nimport { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "ran");\n`,
  );
});

afterEach(() => {
  for (const server of servers.splice(0)) server.dispose();
  rmSync(workspace, { recursive: true, force: true });
});

const start = () => {
  const editor = createEditorServer({
    env: loadEnv({ NODE_ENV: 'test', FS_ROOT: workspace, DATA_DIR: dataDir }, workspace),
    version: '1.0.0',
  });
  servers.push(editor);
  return createLoopbackClient(editor);
};

describe('folder trust', () => {
  it('opens an untrusted folder without running its code, until it is trusted', async () => {
    const client = start();
    const projects = client.api(ProjectsContract);
    const opened = await projects.open({ path: 'pong' });
    expect(opened.trusted).toBe(false);
    expect(existsSync(marker)).toBe(false);
    expect((await projects.model({ id: opened.id })).apps.length).toBeGreaterThan(0);

    const forbidden = { code: 'FORBIDDEN' };
    await expect(
      client.api(RuntimeContract).build({ project: opened.id, apps: [] }),
    ).rejects.toMatchObject(forbidden);
    await expect(projects.install({ id: opened.id })).rejects.toMatchObject(forbidden);
    await expect(
      client.api(PluginsContract).runProjectServers({ project: opened.id, names: ['@acme/x'] }),
    ).rejects.toMatchObject(forbidden);

    await projects.trust({ id: opened.id });
    const reopened = await projects.open({ path: 'pong' });
    expect(reopened.trusted).toBe(true);
    expect(existsSync(marker)).toBe(true);

    const again = start();
    expect((await again.api(ProjectsContract).open({ path: 'pong' })).trusted).toBe(true);
  });

  it('trusts the folders opened before trust existed', async () => {
    mkdirSync(dataDir, { recursive: true });
    const path = await realpath(join(workspace, 'pong'));
    writeFileSync(
      join(dataDir, 'recent-projects.json'),
      JSON.stringify({
        local: [
          {
            id: 'x',
            name: 'pong',
            location: path,
            ref: { path },
            openedAt: new Date().toISOString(),
          },
        ],
      }),
    );
    const projects = start().api(ProjectsContract);
    expect((await projects.open({ path: 'pong' })).trusted).toBe(true);
  });
});
