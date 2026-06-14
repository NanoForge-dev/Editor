import { type Unsubscriber, get, writable } from 'svelte/store';

import { useProject } from '$lib/client/project';

import { systemTransformer, systemsTransformer } from '../transformers';
import { resetSubscriptions } from '../utils';
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

  async create(name: string) {
    const { actions, fs } = useProject();
    const system = await actions.package.createSystem({ systemName: name });
    this._add(systemTransformer(system));
    const dir = await fs.getDirectory();
    await dir.readdir(true);
  }

  async import(names: [string, ...string[]]) {
    const { actions, ecs, fs } = useProject();
    await actions.package.addSystems({ systemNames: names });
    await this.sync();
    await ecs.components.sync();
    const dir = await fs.getDirectory();
    await dir.readdir(true);
  }

  async sync() {
    const { actions } = useProject();
    const systems = await actions.package.getSystems();
    _storage.set(systemsTransformer(systems));
  }

  get(id: string): SystemHandle {
    const system = get(_storage).find((system) => system.id === id);
    if (!system) throw new Error(`System with id ${id} not found`);
    const handle = new SystemHandle(this, system);

    this._subscribe(id, handle);

    return handle;
  }

  async delete(id: string) {
    const systems = get(_storage);
    const system = systems.find((s) => s.id === id);

    if (!system) throw new Error(`System not found: ${id}`);

    _storage.set(systems.filter((s) => s.id !== id));
    const { fs } = useProject();
    const file = await fs.getFile(system.path);
    await file.delete();

    const subscriptions = get(_subscriptions);
    if (subscriptions[id]) {
      subscriptions[id]();
      subscriptions[id] = null;
      _subscriptions.set(subscriptions);
    }
  }

  private _add(system: System) {
    const systems = get(_storage);
    systems.push(system);
    _storage.set(systems);
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
