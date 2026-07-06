import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import { resetListener, resolveStore } from '../../utils';
import type { SceneHandle } from '../scene-handle';
import { SceneSystemHandle } from './system-handle';

const _storage = writable<Record<string, Writable<string[]>>>({});

const _listener = writable<Unsubscriber[] | null>();

export class SceneSystemManager {
  public readonly scene: SceneHandle;
  private readonly _store: Writable<string[]>;

  static reset() {
    _storage.set({});
    resetListener(_listener);
  }

  constructor(scene: SceneHandle, systems: string[]) {
    this.scene = scene;

    this._store = resolveStore(_storage, this.scene.id, systems);

    this._listen();
  }

  get store() {
    return this._store;
  }

  get data() {
    return get(this._store);
  }

  add(system: string) {
    const systems = get(this._store);
    systems.push(system);
    this._store.set(systems);
  }

  get(id: string) {
    const system = get(this._store).find((system) => system === id);
    if (!system) throw new Error(`System with id ${id} not found`);
    return new SceneSystemHandle(this, system);
  }

  delete(id: string) {
    const systems = get(this._store);
    this._store.set(systems.filter((system) => system !== id));
  }

  private _listen() {
    if (get(_listener)) return;
    const unsub = this.scene.manager.ecs.systems.store.subscribe((systems) => {
      const sceneSystems = get(this._store);
      sceneSystems.filter((system) => systems.find((s) => s.id === system));
      this._store.set(sceneSystems);
    });
    _listener.set([unsub]);
  }
}
