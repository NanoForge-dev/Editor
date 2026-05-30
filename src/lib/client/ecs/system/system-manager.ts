import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import { SystemHandle } from '$lib/client/ecs/system/system-handle';

import type { System } from './system.type';

export class SystemManager {
  private readonly _store: Writable<System[]>;
  private readonly _subscriptions: Record<string, Unsubscriber> = {};

  constructor(systems: System[]) {
    this._store = writable<System[]>(systems);
  }

  get store() {
    return this._store;
  }

  add(system: System) {
    const systems = get(this._store);
    systems.push(system);
    this._store.set(systems);
  }

  get(id: string): SystemHandle {
    const system = get(this._store).find((system) => system.id === id);
    if (!system) throw new Error(`System with id ${id} not found`);
    const handle = new SystemHandle(this, system);

    this._subscriptions[id] = handle.store.subscribe((system) => this._update(id, system));
    return handle;
  }

  delete(id: string) {
    const systems = get(this._store);
    this._store.set(systems.filter((system) => system.id !== id));

    if (id in this._subscriptions) this._subscriptions[id]();
  }

  private _update(id: string, system: System) {
    const systems = get(this._store);
    const index = systems.findIndex((s) => s.id === id);
    if (index === -1) return;
    systems[index] = system;
    this._store.set(systems);
  }
}
