import { describe, expect, it, vi } from 'vitest';

import { Emitter } from '@nanoforge-dev/editor-kernel';

import { FileHistoryTracker, type HistoryFileSystem } from '../../src';
import { setup } from '../fixtures/history';

describe('FileHistoryTracker', () => {
  const memoryFs = (initial: Record<string, string>) => {
    const files = new Map(Object.entries(initial));
    const hashOf = (text: string) => `h${text.length}:${text}`;
    const changes = new Emitter<{ path: string; type: string }[]>();
    const fs: HistoryFileSystem & {
      files: Map<string, string>;
      external(path: string, text: string): void;
    } = {
      files,
      readText: async (path) => ({ text: files.get(path)!, hash: hashOf(files.get(path)!) }),
      write: async (path, content, { expectedHash }) => {
        if (hashOf(files.get(path)!) !== expectedHash)
          throw Object.assign(new Error('conflict'), { code: 'CONFLICT' });
        files.set(path, content);
        changes.fire([{ path, type: 'changed' }]); // echo, like the watcher
        return { hash: hashOf(content) };
      },
      onDidChange: changes.event,
      external(path, text) {
        files.set(path, text);
        changes.fire([{ path, type: 'changed' }]);
      },
    };
    return fs;
  };

  it('undoes file edits and survives the echo of its own writes', async () => {
    const fs = memoryFs({ 'main.ts': 'let x = 1;' });
    const { stack } = setup();
    const tracker = new FileHistoryTracker(fs, stack);
    await stack.push(
      tracker.edit('main.ts', [{ start: 8, end: 9, text: '42' }], { label: 'x = 42' }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fs.files.get('main.ts')).toBe('let x = 42;');
    await stack.undo();
    expect(fs.files.get('main.ts')).toBe('let x = 1;');
    await stack.redo();
    expect(fs.files.get('main.ts')).toBe('let x = 42;');
  });

  it('invalidates the context when the file is changed from outside', async () => {
    const fs = memoryFs({ 'main.ts': 'let x = 1;' });
    const { history, stack } = setup();
    const invalidated = vi.fn();
    history.onDidInvalidate(invalidated);
    const tracker = new FileHistoryTracker(fs, stack);
    await stack.push(
      tracker.edit('main.ts', [{ start: 8, end: 9, text: '2' }], { label: 'x = 2' }),
    );
    fs.external('main.ts', 'let x = 2; // hand edit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stack.state.canUndo).toBe(false);
    expect(invalidated).toHaveBeenCalledWith({ contextId: 'scene', reason: 'external-change' });
    expect(fs.files.get('main.ts')).toBe('let x = 2; // hand edit');
  });
});
