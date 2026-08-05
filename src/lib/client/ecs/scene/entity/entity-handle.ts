import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import { resetListeners, resolveStore } from '../../utils';
import { EntityComponentManager } from './component/component-manager';
import type { SceneEntityManager } from './entity-manager';
import type { Entity } from './entity.type';

const _storage = writable<Record<string, Writable<Entity>>>({});

const _listeners = writable<Record<string, Unsubscriber[] | null>>({});

export class SceneEntityHandle {
  public readonly manager: SceneEntityManager;
  public readonly id: string;
  private readonly fullId: string;
  private readonly _store: Writable<Entity>;
  private readonly _components: EntityComponentManager;

  static reset() {
    resetListeners(_listeners);
    _storage.set({});
  }

  constructor(manager: SceneEntityManager, entity: Entity) {
    this.manager = manager;
    this.id = entity.id;
    this.fullId = `${manager.scene.id}/${entity.id}`;

    this._store = resolveStore(_storage, this.fullId, entity);

    this._components = new EntityComponentManager(this, entity.components);

    this._listen();
  }

  get store() {
    return this._store;
  }

  get data() {
    return get(this._store);
  }

  get components() {
    return this._components;
  }

  update(entity: Partial<Entity>) {
    this._store.set({ ...get(this._store), ...entity });
  }

  delete() {
    this.manager.delete(this.id);
  }

  setSelected() {
    this.manager.selected = this;
  }

  private _listen() {
    const listeners = get(_listeners);
    if (listeners[this.fullId]) return;
    const unsub = this._components.store.subscribe((components) => {
      const entity = get(this._store);
      entity.components = components;
      this._store.set(entity);
    });
    _listeners.set({ ...listeners, [this.fullId]: [unsub] });
  }
}
