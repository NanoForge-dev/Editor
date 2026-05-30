import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import type { ComponentParam } from '../../../component/component.type';
import { type EntityComponentHandle } from './component-handle';
import { ComponentParamHandle } from './component-param-handle';

export class ComponentParamManager {
  public readonly component: EntityComponentHandle;
  private readonly _store: Writable<ComponentParam[]>;
  private readonly _valuesStore: Writable<Record<string, string>>;
  private readonly _subscriptions: Record<string, Unsubscriber> = {};

  constructor(component: EntityComponentHandle, params: Record<string, string>) {
    this.component = component;
    this._store = writable(get(component.store).params);
    this._valuesStore = writable(params);

    this._listen();
  }

  get store() {
    return this._store;
  }

  get values() {
    return this._valuesStore;
  }

  get(id: string) {
    const param = get(this._store).find((param) => param.name === id);
    if (!param) throw new Error(`Param with id ${id} not found`);

    const value = get(this._valuesStore)[id];
    const handle = new ComponentParamHandle(this, param, value);
    this._subscriptions[id] = handle.value.subscribe((param) => this._updateParam(id, param));

    return handle;
  }

  delete(id: string) {
    const params = get(this._store);
    this._store.set(
      params.map((param) => (param.name === id ? { ...param, value: undefined } : param)),
    );
  }

  private _listen() {
    this.component.store.subscribe((component) => {
      this._store.set(component.params);
    });
  }

  private _updateParam(id: string, value: any | undefined) {
    const params = get(this._valuesStore);
    params[id] = value;
    this._valuesStore.set(params);
  }
}
