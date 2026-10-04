import { type Observable, ObservableValue } from '@nanoforge-dev/editor-kernel';

import type { ScopeStore, SettingValues } from './scope-store.type';
import { applyPatch } from './setting-values';

export class MemoryScopeStore implements ScopeStore {
  private readonly _values: ObservableValue<SettingValues>;

  constructor(initial: SettingValues = {}) {
    this._values = new ObservableValue(initial);
  }

  get values(): Observable<SettingValues> {
    return this._values.readonly();
  }

  initialize(): Promise<void> {
    return Promise.resolve();
  }

  write(patch: SettingValues): Promise<void> {
    this._values.set(applyPatch(this._values.get(), patch));
    return Promise.resolve();
  }

  dispose(): void {}
}
