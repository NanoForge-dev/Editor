import type { Disposable, Observable } from '@nanoforge-dev/editor-kernel';

import type {
  CommandOrigin,
  HistoryCommand,
  SerializedCommand,
} from '../command/history-command.type';
import { type HistoryStack } from '../stack/history-stack';
import type { InvalidationReason, StackState } from '../stack/history-stack.type';

export interface HistoryContextOptions {
  /** Stable id, e.g. `file:apps/client/src/main.ts`, `layout`, `settings`. */
  readonly id: string;
  readonly label: string;
  /** Plugin name or `core`. */
  readonly owner?: string;
}

export interface HistoryContext extends Disposable {
  readonly id: string;
  readonly label: string;
  readonly owner: string;
  readonly stack: HistoryStack;
}

/** A step of a persisted history (see `HistoryService.persist`). */
export interface PersistedEntry {
  readonly command: SerializedCommand;
  readonly origin: CommandOrigin;
  readonly time: number;
}

/** Where persisted histories live (e.g. IndexedDB, per project). */
export interface HistoryStore {
  load(contextId: string): Promise<readonly PersistedEntry[] | undefined>;
  save(contextId: string, entries: readonly PersistedEntry[]): Promise<void>;
}

export type Deserializer = (data: unknown, label: string) => HistoryCommand | undefined;

export interface HistoryContextInfo {
  readonly id: string;
  readonly label: string;
  readonly owner: string;
  readonly state: StackState;
}

export interface HistoryServiceOptions {
  readonly limit?: Observable<number>;
  readonly mergeWindowMs?: Observable<number>;
  /** Memory budget per context (default 64 MiB). */
  readonly budgetBytes?: number;
  readonly localOrigin?: CommandOrigin;
  readonly now?: () => number;
}

export interface ContextInvalidation {
  readonly contextId: string;
  readonly reason: InvalidationReason;
}
