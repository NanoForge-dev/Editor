import { type Disposable, DisposableStore, type Event } from '@nanoforge-dev/editor-kernel';

import type { CommandOrigin, HistoryCommand } from '../command/history-command.type';
import type { HistoryStack } from '../stack/history-stack';
import { type TextEdit, applyTextEdits } from './apply-text-edits';

/** The file operations history needs (ProjectFs satisfies it). */
export interface HistoryFileSystem {
  readonly onDidChange: Event<readonly { readonly path: string; readonly type: string }[]>;
  readText(path: string): Promise<{ text: string; hash: string }>;
  write(
    path: string,
    content: string,
    options: { expectedHash: string | null },
  ): Promise<{ hash: string }>;
}

/**
 * Tracks the hash each file should have after the editor's own edits. When a tracked file
 * changes to anything else (hand edit, git pull…), the history of that context is invalidated.
 */
export class FileHistoryTracker implements Disposable {
  private readonly _expected = new Map<string, string>();
  /** Writes in progress per path: changes seen meanwhile may be their own echo. */
  private readonly _writing = new Map<string, Promise<unknown>>();
  private readonly _store = new DisposableStore();

  constructor(
    private readonly _fs: HistoryFileSystem,
    private readonly _stack: HistoryStack,
  ) {
    this._store.add(
      _fs.onDidChange((changes) => {
        for (const change of changes)
          if (this._expected.has(change.path)) void this._check(change.path, change.type);
      }),
    );
  }

  expect(path: string, hash: string): void {
    this._expected.set(path, hash);
  }

  expectedHash(path: string): string | undefined {
    return this._expected.get(path);
  }

  /**
   * An undoable edit of a file. It fails (and the step is dropped) if the file no longer has
   * the content the edit produced.
   */
  edit(
    path: string,
    edits: readonly TextEdit[],
    options: { label: string; origin?: CommandOrigin; mergeKey?: string },
  ): HistoryCommand {
    let inverse: TextEdit[] = [];
    let forward = edits;
    const apply = (operations: readonly TextEdit[]) => {
      const task = write(operations);
      this._writing.set(
        path,
        task.catch(() => undefined),
      );
      return task.finally(() => {
        if (this._writing.get(path) === task) this._writing.delete(path);
      });
    };
    const write = async (operations: readonly TextEdit[]) => {
      const current = await this._fs.readText(path);
      const expected = this._expected.get(path);
      if (expected !== undefined && current.hash !== expected) {
        throw new Error(`${path} changed outside of the editor`);
      }
      const result = applyTextEdits(current.text, operations);
      const { hash } = await this._fs.write(path, result.text, { expectedHash: current.hash });
      this._expected.set(path, hash);
      return result.inverse;
    };
    return {
      label: options.label,
      ...(options.origin && { origin: options.origin }),
      ...(options.mergeKey && { mergeKey: options.mergeKey }),
      sizeBytes: edits.reduce((total, edit) => total + edit.text.length * 2 + 16, 0),
      do: async () => {
        inverse = await apply(forward);
      },
      undo: async () => {
        forward = await apply(inverse);
      },
      redo: async () => {
        inverse = await apply(forward);
      },
      isValid: async () => {
        const expected = this._expected.get(path);
        return expected === undefined || (await this._fs.readText(path)).hash === expected;
      },
    };
  }

  dispose(): void {
    this._store.dispose();
  }

  private async _check(path: string, type: string): Promise<void> {
    await this._writing.get(path);
    const expected = this._expected.get(path);
    if (expected === undefined) return;
    const hash =
      type === 'deleted'
        ? null
        : await this._fs.readText(path).then(
            (file) => file.hash,
            () => null,
          );
    if (hash === expected) return; // echo of our own write
    this._expected.delete(path);
    await this._stack.invalidate('external-change');
  }
}
