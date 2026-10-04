import type { CommandOrigin, HistoryCommand } from '../command/history-command.type';

export interface HistoryEntry {
  readonly id: number;
  readonly command: HistoryCommand;
  readonly origin: CommandOrigin;
  /** False for changes of other origins: skipped by undo. */
  readonly undoable: boolean;
  readonly time: number;
}

export interface StackOptions {
  /** Local user: the only origin undo/redo may target. */
  readonly localOrigin: () => CommandOrigin;
  readonly limit: () => number;
  /** Memory budget of the stack in bytes (sum of `sizeBytes`). */
  readonly budgetBytes: () => number;
  readonly mergeWindowMs: () => number;
  readonly now?: () => number;
}

export interface StackState {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly dirty: boolean;
}

export type InvalidationReason = 'external-change' | 'invalid-command' | 'manual';

/** Collects commands of a transaction; `push` executes a command inside the transaction. */
export interface Transaction {
  push(command: HistoryCommand): Promise<void>;
  transaction<T>(label: string, fn: (tx: Transaction) => Promise<T>): Promise<T>;
}
