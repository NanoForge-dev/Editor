import { type Observable, ObservableValue } from '@nanoforge-dev/editor-kernel';
import { SettingsContract } from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';

import type { ScopeStore, SettingValues } from './scope-store.type';
import { applyPatch } from './setting-values';

/** Project-local settings stored server-side (hosted editors, shared checkouts). */
export class RemoteProjectLocalStore implements ScopeStore {
  private readonly _values = new ObservableValue<SettingValues>({});
  private _queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly _rpc: RpcClient,
    private readonly _projectId: string,
  ) {}

  get values(): Observable<SettingValues> {
    return this._values.readonly();
  }

  async initialize(): Promise<void> {
    this._values.set(
      await this._rpc.api(SettingsContract).projectLocalGet({ project: this._projectId }),
    );
  }

  write(patch: SettingValues): Promise<void> {
    const next = applyPatch(this._values.get(), patch);
    this._values.set(next);
    const task = this._queue.then(() =>
      this._rpc
        .api(SettingsContract)
        .projectLocalPut({ project: this._projectId, values: next })
        .then(() => undefined),
    );
    this._queue = task.catch(() => undefined);
    return task;
  }

  dispose(): void {}
}
