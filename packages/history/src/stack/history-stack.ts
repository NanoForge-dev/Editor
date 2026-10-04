import { Emitter, type Event } from '@nanoforge-dev/editor-kernel';

import { compositeCommand, mergeCommands, sameOrigin } from '../command/composite-command';
import type { CommandOrigin, HistoryCommand } from '../command/history-command.type';
import type {
  HistoryEntry,
  InvalidationReason,
  StackOptions,
  StackState,
  Transaction,
} from './history-stack.type';

const SAVED_AT_START = 0;

/**
 * Undo/redo stack of one context. Operations are serialized; commands pushed inside a
 * transaction go through the transaction handle.
 */
export class HistoryStack {
  private _past: HistoryEntry[] = [];
  private _future: HistoryEntry[] = [];
  private _queue: Promise<unknown> = Promise.resolve();
  private _nextId = 1;
  /** Entry id at the savepoint (0: the initial state). */
  private _savedAt: number | null = SAVED_AT_START;
  private readonly _onDidChange = new Emitter<StackState>();
  private readonly _onDidInvalidate = new Emitter<InvalidationReason>();

  readonly onDidChange: Event<StackState> = this._onDidChange.event;
  readonly onDidInvalidate: Event<InvalidationReason> = this._onDidInvalidate.event;

  constructor(private readonly _options: StackOptions) {}

  get state(): StackState {
    const top = this._past.at(-1)?.id ?? SAVED_AT_START;
    return {
      past: [...this._past],
      future: [...this._future],
      canUndo: this._past.some((entry) => entry.undoable),
      canRedo: this._future.length > 0,
      dirty: this._savedAt !== top,
    };
  }

  /** Executes a command and records it (merging with the previous one when allowed). */
  push(command: HistoryCommand): Promise<void> {
    return this._serial(async () => {
      await command.do();
      this._add(command, true);
    });
  }

  /**
   * Records a change already applied elsewhere (e.g. by a collaborator). Changes of other
   * origins are not undoable.
   */
  record(command: HistoryCommand): Promise<void> {
    return this._serial(async () => this._add(command, false));
  }

  /**
   * Groups the commands pushed through `tx` into one step. If `fn` throws, the commands already
   * applied are undone in reverse order and the error is rethrown.
   */
  transaction<T>(label: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return this._serial(async () => {
      const collected: HistoryCommand[] = [];
      const result = await runTransaction(collected, fn);
      if (collected.length)
        this._add(compositeCommand(label, collected, this._options.localOrigin()), true, false);
      return result;
    });
  }

  undo(): Promise<boolean> {
    return this._serial(() => this._undoOne());
  }

  redo(): Promise<boolean> {
    return this._serial(() => this._redoOne());
  }

  /**
   * Undoes or redoes until the entry is the last applied step (0: before every step). Changes
   * of other origins cannot be undone and stay applied.
   */
  goTo(entryId: number): Promise<void> {
    return this._serial(async () => {
      if (this._future.some((entry) => entry.id === entryId)) {
        while (this._future.some((entry) => entry.id === entryId)) {
          if (!(await this._redoOne())) return;
        }
        return;
      }
      for (;;) {
        const last = this._past.findLast((entry) => entry.undoable);
        if (!last || last.id <= entryId) return;
        if (!(await this._undoOne())) return;
      }
    });
  }

  /** Replaces the stack with entries restored after a reload (already applied). */
  restore(
    entries: readonly { command: HistoryCommand; origin: CommandOrigin; time: number }[],
  ): Promise<void> {
    return this._serial(async () => {
      this._drop([...this._past, ...this._future]);
      const local = this._options.localOrigin();
      this._past = entries.map((entry) => ({
        id: this._nextId++,
        command: entry.command,
        origin: entry.origin,
        undoable: sameOrigin(entry.origin, local),
        time: entry.time,
      }));
      this._future = [];
      this._savedAt = null;
      this._trim();
      this._changed();
    });
  }

  /** Marks the current state as saved (dirty tracking). */
  markSaved(): void {
    this._savedAt = this._past.at(-1)?.id ?? SAVED_AT_START;
    this._changed();
  }

  /** Drops every step: the state they relied on changed. */
  invalidate(reason: InvalidationReason = 'manual'): Promise<void> {
    return this._serial(async () => this._invalidate(reason));
  }

  clear(): Promise<void> {
    return this._serial(async () => {
      this._drop([...this._past, ...this._future]);
      this._past = [];
      this._future = [];
      this._savedAt = SAVED_AT_START;
      this._changed();
    });
  }

  /** Re-applies limits (after the limit settings changed). */
  trim(): Promise<void> {
    return this._serial(async () => {
      this._trim();
      this._changed();
    });
  }

  dispose(): void {
    this._drop([...this._past, ...this._future]);
    this._past = [];
    this._future = [];
    this._onDidChange.dispose();
    this._onDidInvalidate.dispose();
  }

  private async _undoOne(): Promise<boolean> {
    const index = this._past.findLastIndex((entry) => entry.undoable);
    if (index < 0) return false;
    const entry = this._past[index]!;
    if ((await entry.command.isValid?.()) === false) {
      this._invalidate('invalid-command');
      return false;
    }
    await entry.command.undo();
    this._past.splice(index, 1);
    this._future.push(entry);
    this._changed();
    return true;
  }

  private async _redoOne(): Promise<boolean> {
    const entry = this._future.at(-1);
    if (!entry) return false;
    if ((await entry.command.isValid?.()) === false) {
      this._invalidate('invalid-command');
      return false;
    }
    await (entry.command.redo ?? entry.command.do).call(entry.command);
    this._future.pop();
    this._past.push(entry);
    this._changed();
    return true;
  }

  private _add(command: HistoryCommand, local: boolean, mergeable = true): void {
    const origin = command.origin ?? this._options.localOrigin();
    const undoable = local && sameOrigin(origin, this._options.localOrigin());
    const now = (this._options.now ?? Date.now)();
    if (undoable) {
      this._drop(this._future);
      this._future = [];
    }
    const previous = this._past.at(-1);
    if (
      mergeable &&
      undoable &&
      previous?.undoable &&
      command.mergeKey !== undefined &&
      previous.command.mergeKey === command.mergeKey &&
      now - previous.time <= this._options.mergeWindowMs() &&
      this._savedAt !== previous.id
    ) {
      const merged = previous.command.merge
        ? previous.command.merge(command)
        : mergeCommands(previous.command, command);
      if (merged) {
        this._past[this._past.length - 1] = { ...previous, command: merged, time: now };
        this._trim();
        this._changed();
        return;
      }
    }
    this._past.push({ id: this._nextId++, command, origin, undoable, time: now });
    this._trim();
    this._changed();
  }

  private _trim(): void {
    const limit = Math.max(1, this._options.limit());
    const budget = this._options.budgetBytes();
    const size = () =>
      [...this._past, ...this._future].reduce(
        (total, entry) => total + (entry.command.sizeBytes ?? 0),
        0,
      );
    while (this._past.length > limit || (this._past.length > 1 && size() > budget)) {
      const dropped = this._past.shift()!;
      if (this._savedAt === dropped.id) this._savedAt = null; // savepoint no longer reachable
      dropped.command.dispose?.();
    }
    while (this._future.length && size() > budget) this._future.shift()!.command.dispose?.();
  }

  private _invalidate(reason: InvalidationReason): void {
    this._drop([...this._past, ...this._future]);
    this._past = [];
    this._future = [];
    this._savedAt = null;
    this._changed();
    this._onDidInvalidate.fire(reason);
  }

  private _drop(entries: readonly HistoryEntry[]): void {
    for (const entry of entries) entry.command.dispose?.();
  }

  private _changed(): void {
    this._onDidChange.fire(this.state);
  }

  private _serial<T>(task: () => Promise<T>): Promise<T> {
    const result = this._queue.then(task, task);
    this._queue = result.catch(() => undefined);
    return result;
  }
}

const runTransaction = async <T>(
  collected: HistoryCommand[],
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> => {
  const start = collected.length;
  const tx: Transaction = {
    push: async (command) => {
      await command.do();
      collected.push(command);
    },
    transaction: (_label, inner) => runTransaction(collected, inner),
  };
  try {
    return await fn(tx);
  } catch (error) {
    for (const command of collected.splice(start).reverse()) {
      await command.undo();
      command.dispose?.();
    }
    throw error;
  }
};
