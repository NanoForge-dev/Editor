import { type Writable, get, writable } from 'svelte/store';

import type { SystemManager } from './system-manager';
import type { System } from './system.type';

export class SystemHandle {
  private _manager: SystemManager;
  public readonly id: string;
  private readonly _store: Writable<System>;

  constructor(manager: SystemManager, system: System) {
    this._manager = manager;
    this._store = writable(system);
    this.id = system.id;
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
