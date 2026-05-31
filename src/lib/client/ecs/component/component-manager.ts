import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import { ComponentHandle } from './component-handle';
import type { Component } from './component.type';

export class ComponentManager {
  private readonly _store: Writable<Component[]>;
  private readonly _subscriptions: Record<string, Unsubscriber> = {};

  constructor(components: Component[]) {
    this._store = writable(components);
  }

  get store() {
    return this._store;
  }

  get data() {
    return get(this._store);
  }

  add(component: Component) {
    const components = get(this._store);
    components.push(component);
    this._store.set(components);
  }

  get(id: string): ComponentHandle {
    const component = get(this._store).find((component) => component.id === id);
    if (!component) throw new Error(`Component with id ${id} not found`);
    const handle = new ComponentHandle(this, component);

    this._subscribe(id, handle);

    return handle;
  }

  delete(id: string) {
    const components = get(this._store);
    this._store.set(components.filter((component) => component.id !== id));

    if (id in this._subscriptions) this._subscriptions[id]();
  }

  private _subscribe(id: string, handle: ComponentHandle) {
    setTimeout(() => {
      this._subscriptions[id] = handle.store.subscribe((component) => this._update(id, component));
    }, 0);
  }

  private _update(id: string, component: Component) {
    const components = get(this._store);
    const index = components.findIndex((s) => s.id === id);
    if (index === -1) return;
    components[index] = component;
    this._store.set(components);
  }
}
