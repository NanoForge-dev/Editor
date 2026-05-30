import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import type { SceneHandle } from '../scene-handle';
import { SceneEntityHandle } from './entity-handle';
import type { Entity } from './entity.type';

export class SceneEntityManager {
  public readonly scene: SceneHandle;
  private readonly _store: Writable<Entity[]>;
  private readonly _subscriptions: Record<string, Unsubscriber> = {};

  constructor(scene: SceneHandle, entities: Entity[]) {
    this.scene = scene;
    this._store = writable(entities);
  }

  get store() {
    return this._store;
  }

  add(entity: Entity) {
    const entities = get(this._store);
    entities.push(entity);
    this._store.set(entities);
  }

  get(id: string) {
    const entity = get(this._store).find((entity) => entity.id === id);
    if (!entity) throw new Error(`Entity with id ${id} not found`);

    const handle = new SceneEntityHandle(this, entity);
    this._subscriptions[id] = handle.store.subscribe((entity) => this._update(id, entity));

    return handle;
  }

  delete(id: string) {
    const entities = get(this._store);
    this._store.set(entities.filter((entity) => entity.id !== id));
  }

  private _update(id: string, entity: Entity) {
    const entities = get(this._store);
    const index = entities.findIndex((s) => s.id === id);
    if (index === -1) return;
    entities[index] = entity;
    this._store.set(entities);
  }
}
