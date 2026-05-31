import { type Writable, get, writable } from 'svelte/store';

import { SceneEntityManager } from './entity/entity-manager';
import type { SceneManager } from './scene-manager';
import type { Scene } from './scene.type';
import { SceneSystemManager } from './system/system-manager';

export class SceneHandle {
  public readonly manager: SceneManager;
  public readonly id: string;
  private readonly _store: Writable<Scene>;
  private readonly _entities: SceneEntityManager;
  private readonly _systems: SceneSystemManager;

  constructor(manager: SceneManager, scene: Scene) {
    this.manager = manager;
    this._store = writable(scene);
    this.id = scene.id;

    this._entities = new SceneEntityManager(this, scene.entities);
    this._systems = new SceneSystemManager(this, scene.systems);

    this._listen();
  }

  get store() {
    return this._store;
  }

  get data() {
    return get(this._store);
  }

  get entities() {
    return this._entities;
  }

  get systems() {
    return this._systems;
  }

  update(scene: Partial<Scene>) {
    this._store.set({ ...get(this._store), ...scene });
  }

  delete() {
    this.manager.delete(this.id);
  }

  setActive() {
    this.manager.active = this;
  }

  setDefault() {
    this.manager.default = this.id;
  }

  private _listen() {
    this._entities.store.subscribe((entities) => {
      const scene = get(this._store);
      scene.entities = entities;
      this._store.set(scene);
    });
    this._systems.store.subscribe((systems) => {
      const scene = get(this._store);
      scene.systems = systems;
      this._store.set(scene);
    });
  }
}
