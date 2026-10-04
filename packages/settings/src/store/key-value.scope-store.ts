import { type Observable, ObservableValue } from '@nanoforge-dev/editor-kernel';

import type { KeyValueStore } from '../key-value/key-value-store.type';
import type { ScopeStore, SettingValues } from './scope-store.type';
import { applyPatch } from './setting-values';

/** A scope persisted as one record of a key/value store (machine scope). */
export class KeyValueScopeStore implements ScopeStore {
  private readonly _values = new ObservableValue<SettingValues>({});

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

  async write(patch: SettingValues): Promise<void> {
    const next = applyPatch(this._values.get(), patch);
    await this._kv.set(this._key, next);
    this._values.set(next);
  }

  dispose(): void {}
}
