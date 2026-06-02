import { type Unsubscriber, get, writable } from 'svelte/store';

import { getId, resetSubscriptions } from '../utils';
import { SystemHandle } from './system-handle';
import type { System } from './system.type';

const _storage = writable<System[]>([]);
const _subscriptions = writable<Record<string, Unsubscriber | null>>({});

export class SystemManager {
  static reset() {
    _storage.set([]);
    resetSubscriptions(_subscriptions);
  }

  constructor(systems: System[]) {
    _storage.set(systems);
  }

  get store() {
    return _storage;
  }

  get data() {
    return get(_storage);
  }

  add(system: Omit<System, 'id' | 'path'> & Partial<Pick<System, 'path'>>): string {
    const systems = get(_storage);
    const id = getId(this.data, system.name);
    systems.push({ ...system, id, path: system.path ?? `systems/${id}.ts` });
    _storage.set(systems);
    return id;
  }

  get(id: string): SystemHandle {
    const system = get(_storage).find((system) => system.id === id);
    if (!system) throw new Error(`System with id ${id} not found`);
    const handle = new SystemHandle(this, system);

    this._subscribe(id, handle);

    return handle;
  }

  delete(id: string) {
    const systems = get(_storage);
    _storage.set(systems.filter((system) => system.id !== id));

    const subscriptions = get(_subscriptions);
    if (subscriptions[id]) {
      subscriptions[id]();
      subscriptions[id] = null;
      _subscriptions.set(subscriptions);
    }
  }

  private _subscribe(id: string, handle: SystemHandle) {
    setTimeout(() => {
      const subscriptions = get(_subscriptions);
      if (subscriptions[id]) return;
      subscriptions[id] = handle.store.subscribe((system) => this._update(id, system));
      _subscriptions.set(subscriptions);
    }, 0);
  }

  private _update(id: string, system: System) {
    const systems = get(_storage);
    const index = systems.findIndex((s) => s.id === id);
    if (index === -1) return;
    systems[index] = system;
    _storage.set(systems);
  }
}
