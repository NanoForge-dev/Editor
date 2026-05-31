import { type Readable, type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import type { ComponentParam } from '../../../component/component.type';
import { resetListeners, resolveStore } from '../../../utils';
import type { ComponentParamManager } from './component-param-manager';

const _storage = writable<Record<string, Writable<ComponentParam>>>({});
const _valueStorage = writable<Record<string, Writable<any | undefined>>>({});

const _listener = writable<Unsubscriber[] | null>();

export class ComponentParamHandle {
  public readonly manager: ComponentParamManager;
  public readonly id: string;
  private readonly _store: Writable<ComponentParam>;
  private readonly _valueStore: Writable<any | undefined>;

  static reset() {
    _storage.set({});
    _valueStorage.set({});
    resetListeners(_listener);
  }

  constructor(manager: ComponentParamManager, param: ComponentParam, value: any | undefined) {
    this.manager = manager;
    this.id = param.name;

    const storageResolvable = `${this.manager.component.manager.entity.manager.scene.id}/${this.manager.component.manager.entity.id}/${this.manager.component.id}/${this.id}`;

    this._store = resolveStore(_storage, storageResolvable, param);
    this._valueStore = resolveStore(_valueStorage, storageResolvable, value);

    this._listen();
  }

  get store(): Readable<ComponentParam> {
    return this._store;
  }

  get value() {
    return this._valueStore;
  }

  delete() {
    this.manager.delete(this.id);
  }

  private _listen() {
    if (get(_listener)) return;
    const unsub = this.manager.component.store.subscribe((component) => {
      const newParam = component.params.find((param) => param.name === this.id);
      if (!newParam) return;
      this._store.set(newParam);
    });
    _listener.set([unsub]);
  }
}
