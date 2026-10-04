import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { MemoryContentCache, MemoryTreeCache, ProjectService } from '@nanoforge-dev/editor-project';
import { createEditorServer, loadEnv } from '@nanoforge-dev/editor-server-core';
import { createLoopbackClient } from '@nanoforge-dev/editor-server-core/testing';

import { FileHistoryTracker, HistoryService } from '../../src';

const workspace = mkdtempSync(join(import.meta.dirname, '../../../server-core/test/.tmp-history-'));
cpSync(
  join(import.meta.dirname, '../../../server-core/test/fixtures/pong-network'),
  join(workspace, 'pong'),
  {
    recursive: true,
  },
);
const editor = createEditorServer({
  env: loadEnv(
    { NODE_ENV: 'test', FS_ROOT: workspace, DATA_DIR: mkdtempSync(join(tmpdir(), 'nf-data-')) },
    workspace,
  ),
  version: 'test',
});
const rpc = createLoopbackClient(editor);
afterAll(() => {
  rpc.dispose();
  editor.dispose();
  rmSync(workspace, { recursive: true, force: true });
});

describe('file history over ProjectFs', () => {
  it('undoes edits of a real project file, then drops history on an outside edit', async () => {
    const project = await new ProjectService(rpc, {
      contents: () => new MemoryContentCache(),
      tree: () => new MemoryTreeCache(),
    }).open({ path: 'pong' });
    const path = 'apps/client/src/main.ts';
    const history = new HistoryService();
    const { stack } = history.registerContext({ id: `file:${path}`, label: path });
    const tracker = new FileHistoryTracker(project.fs, stack);

    const original = (await project.fs.readText(path)).text;
    await stack.push(
      tracker.edit(path, [{ start: 0, end: 0, text: '// edited\n' }], { label: 'comment' }),
    );
    await new Promise((resolve) => setTimeout(resolve, 300)); // watcher echo
    expect(stack.state.canUndo).toBe(true);
    await stack.undo();
    expect((await project.fs.readText(path)).text).toBe(original);

    await stack.redo();
    await new Promise((resolve) => setTimeout(resolve, 300));
    writeFileSync(join(workspace, 'pong', path), '// replaced by git pull\n');
    const start = Date.now();
    while (stack.state.canUndo && Date.now() - start < 2000)
      await new Promise((r) => setTimeout(r, 10));
    expect(stack.state.canUndo).toBe(false);
  });
});
