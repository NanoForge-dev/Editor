import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { FileChange } from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';
import { type EditorServer, createEditorServer, loadEnv } from '@nanoforge-dev/editor-server-core';
import { createLoopbackClient } from '@nanoforge-dev/editor-server-core/testing';

import type { ContentCache } from '../../src/cache/cache.type';
import { MemoryContentCache } from '../../src/cache/memory.content-cache';
import { MemoryTreeCache } from '../../src/cache/memory.tree-cache';
import { ProjectService } from '../../src/service/project-service';

const FIXTURE = join(import.meta.dirname, '../../../server-core/test/fixtures/pong-network');

let workspace: string;
let editor: EditorServer;
let rpc: RpcClient;
let service: ProjectService;
const contents = new MemoryContentCache();
const reads: string[] = [];

/** Content cache spy: counts server reads by observing cache fills. */
const spyCache = (inner: ContentCache): ContentCache => ({
  get: (path) => inner.get(path),
  set: (path, value) => {
    reads.push(path);
    return inner.set(path, value);
  },
  delete: (path) => inner.delete(path),
  clear: () => inner.clear(),
});

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
  service = new ProjectService(rpc, {
    contents: () => spyCache(contents),
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
    await new Promise((resolve) => setTimeout(resolve, 300)); // server watcher initial scan
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
});
