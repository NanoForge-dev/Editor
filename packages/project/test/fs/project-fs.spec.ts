import { cpSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type FileChange, FsContract } from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';
import { type EditorServer, createEditorServer, loadEnv } from '@nanoforge-dev/editor-server-core';
import { createLoopbackClient } from '@nanoforge-dev/editor-server-core/testing';

import { MemoryContentCache } from '../../src/cache/memory.content-cache';
import { MemoryTreeCache } from '../../src/cache/memory.tree-cache';
import { ProjectService } from '../../src/service/project-service';

const FIXTURE = join(import.meta.dirname, '../../../server-core/test/fixtures/pong-network');

let workspace: string;
let editor: EditorServer;
let rpc: RpcClient;
let service: ProjectService;
const contents = new MemoryContentCache();
/** Files the server sent bytes for, and files it answered "not modified" for. */
const reads: string[] = [];
const notModified: string[] = [];

const waitFor = async (predicate: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!predicate() && Date.now() - start < timeout) await new Promise((r) => setTimeout(r, 5));
  return Date.now() - start;
};

beforeAll(async () => {
  workspace = mkdtempSync(join(import.meta.dirname, '../../../server-core/test/.tmp-project-'));
  cpSync(FIXTURE, join(workspace, 'pong'), { recursive: true });
  editor = createEditorServer({
    env: loadEnv(
      { NODE_ENV: 'test', FS_ROOT: workspace, DATA_DIR: mkdtempSync(join(tmpdir(), 'nf-data-')) },
      workspace,
    ),
    version: 'test',
  });
  rpc = createLoopbackClient(editor);
  const api = rpc.api.bind(rpc);
  rpc.api = ((contract: Parameters<RpcClient['api']>[0]) => {
    const methods = api(contract);
    if (contract !== FsContract) return methods;
    const fs = methods as ReturnType<typeof api<typeof FsContract>>;
    return {
      ...fs,
      readMany: async (input: Parameters<typeof fs.readMany>[0]) => {
        const answer = await fs.readMany(input);
        for (const file of answer.files)
          if ('notModified' in file) notModified.push(file.path);
          else if (!('error' in file)) reads.push(file.path);
        return answer;
      },
    };
  }) as RpcClient['api'];
  service = new ProjectService(rpc, {
    contents: () => contents,
    tree: () => new MemoryTreeCache(),
  });
});

afterAll(() => {
  service.dispose();
  rpc.dispose();
  editor.dispose();
  rmSync(workspace, { recursive: true, force: true });
});

describe('ProjectFs', () => {
  it('opens the project with its tree and engine libs', async () => {
    const project = await service.open({ path: 'pong' });
    expect(project.fs.ready.get()).toBe(true);
    expect(project.fs.children('apps').map((entry) => entry.path)).toEqual([
      'apps/client',
      'apps/server',
    ]);
    expect(project.apps.get().map((app) => app.id)).toEqual(['apps/client', 'apps/server']);
    expect(project.apps.get()[0]!.engineLibs).toHaveProperty('@nanoforge-dev/ecs');
  });

  it('serves unchanged files from the content cache', async () => {
    const project = service.current.get()!;
    reads.length = 0;
    const first = await project.fs.readText('apps/client/src/main.ts');
    const second = await project.fs.readText('apps/client/src/main.ts');
    expect(second).toEqual(first);
    expect(reads).toEqual(['apps/client/src/main.ts']);
  });

  it('sees files written on disk within 200 ms', async () => {
    const project = service.current.get()!;
    const changes: FileChange[] = [];
    const subscription = project.fs.onDidChange((batch) => changes.push(...batch));
    /** Server watcher initial scan. */
    await new Promise((resolve) => setTimeout(resolve, 300));
    writeFileSync(join(workspace, 'pong/apps/client/src/main.ts'), '// edited outside\n');
    const elapsed = await waitFor(() => changes.length > 0);
    subscription.dispose();
    expect(changes).toEqual([{ type: 'changed', path: 'apps/client/src/main.ts', kind: 'file' }]);
    expect(elapsed).toBeLessThan(200);
    expect((await project.fs.readText('apps/client/src/main.ts')).text).toBe('// edited outside\n');
  });

  it('writes with conflict detection and without echoing its own writes', async () => {
    const project = service.current.get()!;
    const { hash } = await project.fs.readText('apps/client/src/main.ts');
    const changes: FileChange[] = [];
    const subscription = project.fs.onDidChange((batch) => changes.push(...batch));
    await project.fs.write('apps/client/src/main.ts', '// v2\n', { expectedHash: hash });
    await new Promise((resolve) => setTimeout(resolve, 250));
    subscription.dispose();
    expect(changes).toEqual([{ type: 'changed', path: 'apps/client/src/main.ts', kind: 'file' }]);
    await expect(
      project.fs.write('apps/client/src/main.ts', 'x', { expectedHash: hash }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('reads again only what changed: not a touch, a rename, or a current copy', async () => {
    const project = service.current.get()!;
    const path = 'apps/client/src/main.ts';
    const file = join(workspace, 'pong', path);
    await project.fs.readText(path);
    reads.length = 0;
    notModified.length = 0;

    const later = new Date(Date.now() + 120_000);
    utimesSync(file, later, later);
    await project.fs.refresh();
    expect((await project.fs.readText(path, { fresh: true })).text).toContain('');
    expect(reads).toEqual([]);
    expect(notModified).toEqual([path]);

    const before = statSync(file);
    const text = (await project.fs.readText(path)).text;
    writeFileSync(
      file,
      text.replace(/./, (char) => (char === 'x' ? 'y' : 'x')),
    );
    utimesSync(file, before.atime, before.mtime);
    await project.fs.refresh();
    expect((await project.fs.readText(path)).text).not.toBe(text);
    expect(reads).toEqual([path]);

    reads.length = 0;
    await project.fs.rename(path, 'apps/client/src/renamed.ts');
    await project.fs.readText('apps/client/src/renamed.ts');
    expect(reads).toEqual([]);
    await project.fs.rename('apps/client/src/renamed.ts', path);
    writeFileSync(file, text);
    await project.fs.refresh();
  });
});
