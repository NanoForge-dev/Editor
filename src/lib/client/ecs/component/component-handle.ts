import { type Writable, get, writable } from 'svelte/store';

import { resolveStore } from '../utils';
import type { ComponentManager } from './component-manager';
import type { Component } from './component.type';

const _storage = writable<Record<string, Writable<Component>>>({});

export class ComponentHandle {
  private _manager: ComponentManager;
  private readonly _store: Writable<Component>;
  public readonly id: string;

  static reset() {
    _storage.set({});
  }

  constructor(manager: ComponentManager, component: Component) {
    this._manager = manager;
    this.id = component.id;

    this._store = resolveStore(_storage, this.id, component);
  }

  get store() {
    return this._store;
  }

  get data() {
    return get(this._store);
  }

  update(component: Partial<Component>) {
    this._store.set({ ...get(this._store), ...component });
  }

  delete() {
    return this._manager.delete(this.id);
  }
}
