import type { Event } from '@nanoforge-dev/editor-kernel';

import type { SettingValues } from '../store/scope-store.type';

export interface AccountDocument {
  /** Opaque revision (ETag); null before the first save. */
  readonly revision: string | null;
  readonly values: SettingValues;
}

/** Remote copy of the account settings (the editor server, which talks to the API). */
export interface AccountRemote {
  /** Fired when the connection came back: pending edits are flushed. */
  readonly onDidReconnect?: Event<void>;
  get(): Promise<AccountDocument>;
  /**
   * Saves when the remote revision is still `baseRevision`. Otherwise throws an error with
   * `code: 'CONFLICT'` and the current document as `data`.
   */
  put(baseRevision: string | null, values: SettingValues): Promise<{ revision: string }>;
}

export type SyncStatus = 'idle' | 'syncing' | 'pending' | 'offline' | 'conflict' | 'error';

export interface AccountSyncOptions {
  /** Keys that may leave the machine (settings with `sync: false` stay local). */
  isSynced?: (key: string) => boolean;
  debounceMs?: number;
  /** Retry delays while offline; the last one repeats. */
  retryDelays?: readonly number[];
}
