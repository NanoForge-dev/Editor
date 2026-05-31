import { type Unsubscriber, get, writable } from 'svelte/store';

import { resetSubscriptions } from '../utils';
import { ComponentHandle } from './component-handle';
import type { Component } from './component.type';

const _storage = writable<Component[]>([]);

const _subscriptions = writable<Record<string, Unsubscriber | null>>({});

export class ComponentManager {
  static reset() {
    _storage.set([]);
    resetSubscriptions(_subscriptions);
  }

  constructor(components: Component[]) {
    _storage.set(components);
  }

  get store() {
    return _storage;
  }

  get data() {
    return get(_storage);
  }

  add(component: Component) {
    const components = get(_storage);
    components.push(component);
    _storage.set(components);
  }

  get(id: string): ComponentHandle {
    const component = get(_storage).find((component) => component.id === id);
    if (!component) throw new Error(`Component with id ${id} not found`);
    const handle = new ComponentHandle(this, component);

    this._subscribe(id, handle);

    return handle;
  }

  delete(id: string) {
    const components = get(_storage);
    _storage.set(components.filter((component) => component.id !== id));

    const subscriptions = get(_subscriptions);
    if (subscriptions[id]) {
      subscriptions[id]();
      subscriptions[id] = null;
      _subscriptions.set(subscriptions);
    }
  }

  private _subscribe(id: string, handle: ComponentHandle) {
    setTimeout(() => {
      const subscriptions = get(_subscriptions);
      if (subscriptions[id]) return;
      subscriptions[id] = handle.store.subscribe((component) => this._update(id, component));
      _subscriptions.set(subscriptions);
    }, 0);
  }

  private _update(id: string, component: Component) {
    const components = get(_storage);
    const index = components.findIndex((s) => s.id === id);
    if (index === -1) return;
    components[index] = component;
    _storage.set(components);
  }
}
