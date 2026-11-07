import { type Observable, ObservableValue } from '@nanoforge-dev/editor-kernel';

import type { KeyValueStore } from '../key-value/key-value-store.type';
import type { ScopeStore, SettingValues } from './scope-store.type';
import { applyPatch } from './setting-values';

/** A scope persisted as one record of a key/value store (machine scope). */
export class KeyValueScopeStore implements ScopeStore {
  private readonly _values = new ObservableValue<SettingValues>({});
  /** Writes run one at a time: two at once both started from the same values, and one was lost. */
  private _queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly _kv: KeyValueStore,
    private readonly _key: string,
  ) {}

  get values(): Observable<SettingValues> {
    return this._values.readonly();
  }

  async initialize(): Promise<void> {
    this._values.set((await this._kv.get<SettingValues>(this._key)) ?? {});
  }

  write(patch: SettingValues): Promise<void> {
    const task = this._queue.then(async () => {
      const next = applyPatch(this._values.get(), patch);
      await this._kv.set(this._key, next);
      this._values.set(next);
    });
    this._queue = task.catch(() => undefined);
    return task;
  }

  dispose(): void {}
}
