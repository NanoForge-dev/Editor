import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import { resetListeners, resetSubscriptions } from '../../../utils';
import { resolveStore } from '../../../utils';
import type { SceneEntityHandle } from '../entity-handle';
import { EntityComponentHandle } from './component-handle';

const _storage = writable<Record<string, Writable<Record<string, Record<string, string>>>>>({});

const _subscriptions = writable<Record<string, Unsubscriber | null>>({});

const _listener = writable<Unsubscriber[] | null>();

export class EntityComponentManager {
  public readonly entity: SceneEntityHandle;
  private readonly _store: Writable<Record<string, Record<string, string>>>;

  static reset() {
    _storage.set({});
    resetSubscriptions(_subscriptions);
    resetListeners(_listener);
  }

  constructor(entity: SceneEntityHandle, components: Record<string, Record<string, string>>) {
    this.entity = entity;

    const storageResolvable = `${this.entity.manager.scene.id}/${this.entity.id}`;

    this._store = resolveStore(_storage, storageResolvable, components);

    this._listen();
  }

  get store() {
    return this._store;
  }

  get data() {
    return get(this._store);
  }

  add(component: string) {
    const components = get(this._store);
    const manifest = this.entity.manager.scene.manager.ecs.components.get(component).data;
    components[component] = {
      ...Object.fromEntries(
        manifest.params
          .filter((param) => param.default)
          .map((param) => [param.name, param.default as string]),
      ),
    };
    this._store.set(components);
  }

  get(id: string): EntityComponentHandle {
    const params = get(this._store)[id];
    if (!params) throw new Error(`Component with id ${id} not found`);
    const handle = new EntityComponentHandle(this, id, params);

    this._subscribe(id, handle);

    return handle;
  }

  delete(id: string) {
    const components = get(this._store);
    const newComponents: Record<string, Record<string, string>> = {};
    Object.entries(components).forEach(([key, params]) => {
      if (key !== id) newComponents[key] = params;
    });
    this._store.set(newComponents);

    const subscriptions = get(_subscriptions);
    if (subscriptions[id]) {
      subscriptions[id]();
      subscriptions[id] = null;
      _subscriptions.set(subscriptions);
    }
  }

  private _listen() {
    if (get(_listener)) return;
    const unsub = this.entity.manager.scene.manager.ecs.components.store.subscribe((components) => {
      const entityComponents = get(this._store);
      const newComponents: Record<string, Record<string, string>> = {};
      Object.entries(entityComponents).forEach(([key, params]) => {
        if (components.find((s) => s.id === key)) newComponents[key] = params;
      });
      this._store.set(newComponents);
    });
    _listener.set([unsub]);
  }

  private _subscribe(id: string, handle: EntityComponentHandle) {
    setTimeout(() => {
      const subscriptions = get(_subscriptions);
      if (subscriptions[id]) return;
      subscriptions[id] = handle.params.values.subscribe((params) => this._update(id, params));
      _subscriptions.set(subscriptions);
    }, 0);
  }

  private _update(id: string, params: Record<string, string>) {
    const component = get(this._store);
    component[id] = params;
    this._store.set(component);
  }
}
