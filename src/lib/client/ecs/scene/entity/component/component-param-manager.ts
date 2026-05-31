import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import type { ComponentParam } from '../../../component/component.type';
import { resetListeners, resetSubscriptions } from '../../../utils';
import { resolveStore } from '../../../utils';
import type { EntityComponentHandle } from './component-handle';
import { ComponentParamHandle } from './component-param-handle';

const _storage = writable<Record<string, Writable<ComponentParam[]>>>({});
const _valueStorage = writable<Record<string, Writable<Record<string, string>>>>({});

const _subscriptions = writable<Record<string, Unsubscriber | null>>({});

const _listener = writable<Unsubscriber[] | null>();

export class ComponentParamManager {
  public readonly component: EntityComponentHandle;
  private readonly _store: Writable<ComponentParam[]>;
  private readonly _valuesStore: Writable<Record<string, string>>;

  static reset() {
    _storage.set({});
    _valueStorage.set({});
    resetSubscriptions(_subscriptions);
    resetListeners(_listener);
  }

  constructor(component: EntityComponentHandle, params: Record<string, string>) {
    this.component = component;

    const storageResolvable = `${this.component.manager.entity.manager.scene.id}/${this.component.manager.entity.id}/${this.component.id}`;

    this._store = resolveStore(_storage, storageResolvable, get(component.store).params);
    this._valuesStore = resolveStore(_valueStorage, storageResolvable, params);

    this._listen();
  }

  get store() {
    return this._store;
  }

  get values() {
    return this._valuesStore;
  }

  get(id: string): ComponentParamHandle {
    const param = get(this._store).find((param) => param.name === id);
    if (!param) throw new Error(`Param with id ${id} not found`);

    const value = get(this._valuesStore)[id];
    const handle = new ComponentParamHandle(this, param, value);

    this._subscribe(id, handle);

    return handle;
  }

  delete(id: string) {
    const params = get(this._store);
    this._store.set(
      params.map((param) => (param.name === id ? { ...param, value: undefined } : param)),
    );

    const subscriptions = get(_subscriptions);
    if (subscriptions[id]) {
      subscriptions[id]();
      subscriptions[id] = null;
      _subscriptions.set(subscriptions);
    }
  }

  private _listen() {
    if (get(_listener)) return;
    const unsub = this.component.store.subscribe((component) => {
      this._store.set(component.params);
    });
    _listener.set([unsub]);
  }

  private _subscribe(id: string, handle: ComponentParamHandle) {
    setTimeout(() => {
      const subscriptions = get(_subscriptions);
      if (subscriptions[id]) return;
      subscriptions[id] = handle.store.subscribe((param) => this._update(id, param));
      _subscriptions.set(subscriptions);
    }, 0);
  }

  private _update(id: string, value: any | undefined) {
    const params = get(this._valuesStore);
    params[id] = value;
    this._valuesStore.set(params);
  }
}
