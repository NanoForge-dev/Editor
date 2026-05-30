import { type Writable, get, writable } from 'svelte/store';

import { EntityComponentManager } from './component/component-manager';
import type { SceneEntityManager } from './entity-manager';
import type { Entity } from './entity.type';

export class SceneEntityHandle {
  public readonly manager: SceneEntityManager;
  public readonly id: string;
  private readonly _store: Writable<Entity>;
  private readonly _components: EntityComponentManager;

  constructor(manager: SceneEntityManager, entity: Entity) {
    this.manager = manager;
    this._store = writable(entity);
    this.id = entity.id;

    this._components = new EntityComponentManager(this, entity.components);

    this._listen();
  }

  get store() {
    return this._store;
  }

  update(entity: Partial<Entity>) {
    this._store.set({ ...get(this._store), ...entity });
  }

  delete() {
    this.manager.delete(this.id);
  }

  private _listen() {
    this._components.store.subscribe((components) => {
      const entity = get(this._store);
      entity.components = components;
      this._store.set(entity);
    });
  }
}
