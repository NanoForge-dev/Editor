import { type Writable, get, writable } from 'svelte/store';

import type { SceneEntityHandle } from '../entity-handle';
import { EntityComponentHandle } from './component-handle';

export class EntityComponentManager {
  public readonly entity: SceneEntityHandle;
  private readonly _store: Writable<Record<string, Record<string, string>>>;

  constructor(entity: SceneEntityHandle, components: Record<string, Record<string, string>>) {
    this.entity = entity;
    this._store = writable(components);

    this._listen();
  }

  get store() {
    return this._store;
  }

  add(component: string) {
    const components = get(this._store);
    components[component] = {};
    this._store.set(components);
  }

  get(id: string) {
    const params = get(this._store)[id];
    if (!params) throw new Error(`Component with id ${id} not found`);
    const handle = new EntityComponentHandle(this, id, params);
    handle.params.values.subscribe((params) => this._update(id, params));
    return handle;
  }

  delete(id: string) {
    const components = get(this._store);
    const newComponents: Record<string, Record<string, string>> = {};
    Object.entries(components).forEach(([key, params]) => {
      if (key !== id) newComponents[key] = params;
    });
    this._store.set(newComponents);
  }

  private _listen() {
    this.entity.manager.scene.manager.ecs.components.store.subscribe((components) => {
      const entityComponents = get(this._store);
      const newComponents: Record<string, Record<string, string>> = {};
      Object.entries(entityComponents).forEach(([key, params]) => {
        if (components.find((s) => s.id === key)) newComponents[key] = params;
      });
      this._store.set(newComponents);
    });
  }

  private _update(id: string, params: Record<string, string>) {
    const component = get(this._store);
    component[id] = params;
    this._store.set(component);
  }
}
