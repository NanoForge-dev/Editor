import { type Writable, get, writable } from 'svelte/store';

import type { ComponentManager } from './component-manager';
import type { Component } from './component.type';

export class ComponentHandle {
  private _manager: ComponentManager;
  private readonly _store: Writable<Component>;
  public readonly id: string;

  constructor(manager: ComponentManager, component: Component) {
    this._manager = manager;
    this._store = writable(component);
    this.id = component.id;
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
    this._manager.delete(this.id);
  }
}
