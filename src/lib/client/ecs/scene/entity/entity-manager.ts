import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import { getId, resetSubscriptions } from '../../utils';
import { resolveStore } from '../../utils';
import type { SceneHandle } from '../scene-handle';
import { SceneEntityHandle } from './entity-handle';
import type { Entity } from './entity.type';

const _storage = writable<Record<string, Writable<Entity[]>>>({});

const _subscriptions = writable<Record<string, Unsubscriber | null>>({});

const selectedEntity = writable<SceneEntityHandle | undefined>(undefined);

export class SceneEntityManager {
  public readonly scene: SceneHandle;
  private readonly _store: Writable<Entity[]>;

  static reset() {
    _storage.set({});
    resetSubscriptions(_subscriptions);
  }

  constructor(scene: SceneHandle, entities: Entity[]) {
    this.scene = scene;

    this._store = resolveStore(_storage, this.scene.id, entities);
  }

  get store() {
    return this._store;
  }

  get data() {
    return get(this._store);
  }

  get selectedData(): SceneEntityHandle | undefined {
    return get(selectedEntity);
  }

  get selected(): Writable<SceneEntityHandle | undefined> {
    return selectedEntity;
  }

  set selected(entity: SceneEntityHandle | undefined) {
    selectedEntity.set(entity);
  }

  add(entity: Omit<Entity, 'id'>): string {
    const entities = get(this._store);
    const id = getId(this.data, entity.name);
    entities.push({ ...entity, id });
    this._store.set(entities);
    return id;
  }

  get(id: string): SceneEntityHandle {
    const entity = get(this._store).find((entity) => entity.id === id);
    if (!entity) throw new Error(`Entity with id ${id} not found`);
    const handle = new SceneEntityHandle(this, entity);

    this._subscribe(id, handle);

    return handle;
  }

  delete(id: string) {
    const entities = get(this._store);
    this._store.set(entities.filter((entity) => entity.id !== id));

    const subscriptions = get(_subscriptions);
    if (subscriptions[id]) {
      subscriptions[id]();
      subscriptions[id] = null;
      _subscriptions.set(subscriptions);
    }

    if (this.selectedData?.id === id) {
      this.selected = undefined;
    }
  }

  private _subscribe(id: string, handle: SceneEntityHandle) {
    setTimeout(() => {
      const subscriptions = get(_subscriptions);
      if (subscriptions[id]) return;
      subscriptions[id] = handle.store.subscribe((entity) => this._update(id, entity));
      _subscriptions.set(subscriptions);
    }, 0);
  }

  private _update(id: string, entity: Entity) {
    const entities = get(this._store);
    const index = entities.findIndex((s) => s.id === id);
    if (index === -1) return;
    entities[index] = entity;
    this._store.set(entities);
  }
}
