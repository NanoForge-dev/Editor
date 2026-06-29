import { type Writable, get, writable } from 'svelte/store';

import { resolveStore } from '../utils';
import type { AssetManager } from './asset-manager';
import type { Asset } from './asset.type';

const _storage = writable<Record<string, Writable<Asset>>>({});

export class AssetHandle {
  private _manager: AssetManager;
  private readonly _store: Writable<Asset>;
  public readonly id: string;

  static reset() {
    _storage.set({});
  }

  constructor(manager: AssetManager, asset: Asset) {
    this._manager = manager;
    this.id = asset.id;

    this._store = resolveStore(_storage, this.id, asset);
  }

  get store() {
    return this._store;
  }

  get data() {
    return get(this._store);
  }

  update(asset: Partial<Asset>) {
    this._store.set({ ...get(this._store), ...asset });
  }

  delete() {
    return this._manager.delete(this.id);
  }
}
