import { type Writable, writable } from 'svelte/store';

import type { ComponentParam } from '../../../component/component.type';
import type { ComponentParamManager } from './component-param-manager';

export class ComponentParamHandle {
  public readonly manager: ComponentParamManager;
  public readonly id: string;
  private readonly _store: Writable<ComponentParam>;
  private readonly _valueStore: Writable<any | undefined>;

  constructor(manager: ComponentParamManager, param: ComponentParam, value: any | undefined) {
    this.manager = manager;
    this._store = writable(param);
    this._valueStore = writable(value);
    this.id = param.name;

    this._listen();
  }

  get store() {
    return this._store;
  }

  get value() {
    return this._valueStore;
  }

  delete() {
    this.manager.delete(this.id);
  }

  private _listen() {
    this.manager.component.store.subscribe((component) => {
      const newParam = component.params.find((param) => param.name === this.id);
      if (!newParam) return;
      this._store.set(newParam);
    });
  }
}
