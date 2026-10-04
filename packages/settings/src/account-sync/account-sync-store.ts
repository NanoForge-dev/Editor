import {
  DisposableStore,
  type Observable,
  ObservableValue,
  createToken,
} from '@nanoforge-dev/editor-kernel';

import type { KeyValueStore } from '../key-value/key-value-store.type';
import { deepEqual } from '../merge/deep-merge';
import { type MergeConflict, merge3 } from '../merge/merge3';
import type { ScopeStore, SettingValues } from '../store/scope-store.type';
import { applyPatch } from '../store/setting-values';
import type {
  AccountDocument,
  AccountRemote,
  AccountSyncOptions,
  SyncStatus,
} from './account-sync.type';

interface PersistedState {
  base: AccountDocument;
  local: SettingValues;
  dirty: boolean;
}

const errorCode = (error: unknown) => (error as { code?: string } | null)?.code;
const OFFLINE_CODES = new Set(['UNAVAILABLE', 'TIMEOUT']);

/**
 * Account scope: edits apply locally at once, are persisted (offline queue) and pushed to the
 * remote in the background. Concurrent edits from other devices are merged per key against the
 * last synced base; keys changed on both sides keep the local value and are reported as
 * conflicts for the user to settle.
 */
export class AccountSyncStore implements ScopeStore {
  private readonly _values = new ObservableValue<SettingValues>({});
  private readonly _status = new ObservableValue<SyncStatus>('idle');
  private readonly _conflicts = new ObservableValue<readonly MergeConflict[]>([]);
  private readonly _store = new DisposableStore();
  private _state: PersistedState = {
    base: { revision: null, values: {} },
    local: {},
    dirty: false,
  };
  private _running: Promise<void> | undefined;
  private _rerun = false;
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _attempt = 0;
  private _disposed = false;

  constructor(
    private readonly _remote: AccountRemote,
    private readonly _kv: KeyValueStore,
    private readonly _key: string,
    private readonly _options: AccountSyncOptions = {},
  ) {}

  get values(): Observable<SettingValues> {
    return this._values.readonly();
  }

  get status(): Observable<SyncStatus> {
    return this._status.readonly();
  }

  get conflicts(): Observable<readonly MergeConflict[]> {
    return this._conflicts.readonly();
  }

  /** True while local edits have not reached the remote. */
  get dirty(): boolean {
    return this._state.dirty;
  }

  async initialize(): Promise<void> {
    const persisted = await this._kv.get<PersistedState>(this._key);
    if (persisted) this._state = persisted;
    this._values.set(this._state.local);
    if (this._remote.onDidReconnect) {
      this._store.add(this._remote.onDidReconnect(() => void this.sync()));
    }
    await this.sync();
  }

  async write(patch: SettingValues): Promise<void> {
    this._state = { ...this._state, local: applyPatch(this._state.local, patch), dirty: true };
    this._values.set(this._state.local);
    await this._persist();
    this._schedule(this._options.debounceMs ?? 500);
  }

  /** Settles a conflict with the chosen value (pushed like any edit). */
  async resolveConflict(key: string, value: unknown): Promise<void> {
    this._conflicts.set(this._conflicts.get().filter((conflict) => conflict.key !== key));
    await this.write({ [key]: value });
  }

  /** Pulls or pushes now (serialized; a call during a run triggers one more run). */
  sync(): Promise<void> {
    if (this._running) {
      this._rerun = true;
      return this._running;
    }
    clearTimeout(this._timer);
    this._running = this._run().finally(() => {
      this._running = undefined;
      if (this._rerun && !this._disposed) {
        this._rerun = false;
        void this.sync();
      }
    });
    return this._running;
  }

  dispose(): void {
    this._disposed = true;
    clearTimeout(this._timer);
    this._store.dispose();
  }

  private async _run(): Promise<void> {
    this._status.set('syncing');
    try {
      if (this._state.dirty) await this._push();
      else await this._pull();
      this._attempt = 0;
      this._status.set(
        this._conflicts.get().length ? 'conflict' : this._state.dirty ? 'pending' : 'idle',
      );
    } catch (error) {
      if (OFFLINE_CODES.has(errorCode(error) ?? '') || error instanceof TypeError) {
        this._status.set('offline');
        const delays = this._options.retryDelays ?? [1000, 2000, 5000, 15_000, 60_000];
        this._schedule(delays[Math.min(this._attempt++, delays.length - 1)]!);
      } else {
        this._status.set('error');
      }
    }
  }

  private async _pull(): Promise<void> {
    const remote = await this._remote.get();
    if (remote.revision === this._state.base.revision) return;
    this._state = {
      base: remote,
      local: { ...remote.values, ...this._localOnly(this._state.local) },
      dirty: false,
    };
    this._values.set(this._state.local);
    await this._persist();
  }

  private async _push(attempt = 0): Promise<void> {
    const sent = this._synced(this._state.local);
    try {
      const { revision } = await this._remote.put(this._state.base.revision, sent);
      const dirty = !deepEqual(this._synced(this._state.local), sent);
      this._state = { ...this._state, base: { revision, values: sent }, dirty };
      await this._persist();
      if (dirty) this._rerun = true;
    } catch (error) {
      if (errorCode(error) !== 'CONFLICT' || attempt >= 3) throw error;
      const remote = (error as { data?: AccountDocument }).data ?? (await this._remote.get());
      const { values, conflicts } = merge3(this._state.base.values, sent, remote.values);
      this._state = {
        base: remote,
        local: { ...values, ...this._localOnly(this._state.local) },
        dirty: true,
      };
      this._values.set(this._state.local);
      if (conflicts.length) this._conflicts.set([...this._conflicts.get(), ...conflicts]);
      await this._persist();
      await this._push(attempt + 1);
    }
  }

  private _synced(values: SettingValues): Record<string, unknown> {
    const isSynced = this._options.isSynced ?? (() => true);
    return Object.fromEntries(Object.entries(values).filter(([key]) => isSynced(key)));
  }

  private _localOnly(values: SettingValues): Record<string, unknown> {
    const isSynced = this._options.isSynced ?? (() => true);
    return Object.fromEntries(Object.entries(values).filter(([key]) => !isSynced(key)));
  }

  private _persist(): Promise<void> {
    return this._kv.set(this._key, this._state);
  }

  private _schedule(delay: number): void {
    if (this._disposed) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => void this.sync(), delay);
  }
}

/** The account scope's store: sync status and conflicts (settings UI, status bar). */
export const AccountSyncToken = createToken<AccountSyncStore>('settings.accountSync');
