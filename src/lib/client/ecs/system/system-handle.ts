import { type Writable, get, writable } from 'svelte/store';

import { resolveStore } from '../utils';
import type { SystemManager } from './system-manager';
import type { System } from './system.type';

const _storage = writable<Record<string, Writable<System>>>({});

export class SystemHandle {
  private _manager: SystemManager;
  public readonly id: string;
  private readonly _store: Writable<System>;

  static reset() {
    _storage.set({});
  }

  constructor(manager: SystemManager, system: System) {
    this._manager = manager;
    this.id = system.id;

    this._store = resolveStore(_storage, this.id, system);
  }

  get store() {
    return this._store;
  }

  get data() {
    return get(this._store);
  }

  update(system: Partial<System>) {
    this._store.set({ ...get(this._store), ...system });
  }

  delete() {
    this._manager.delete(this.id);
  }
}
