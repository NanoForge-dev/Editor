import { type Writable, get, writable } from 'svelte/store';

import type { SceneHandle } from '../scene-handle';
import { SceneSystemHandle } from './system-handle';

export class SceneSystemManager {
  public readonly scene: SceneHandle;
  private readonly _store: Writable<string[]>;

  constructor(scene: SceneHandle, systems: string[]) {
    this.scene = scene;
    this._store = writable<string[]>(systems);

    this._listen();
  }

  get store() {
    return this._store;
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
    this.scene.manager.ecs.systems.store.subscribe((systems) => {
      const sceneSystems = get(this._store);
      sceneSystems.filter((system) => systems.find((s) => s.id === system));
      this._store.set(sceneSystems);
    });
  }
}
