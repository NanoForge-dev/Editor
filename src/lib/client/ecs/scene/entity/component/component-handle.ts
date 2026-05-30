import { type Writable } from 'svelte/store';

import type { Component } from '../../../component/component.type';
import type { EntityComponentManager } from './component-manager';
import { ComponentParamManager } from './component-param-manager';

export class EntityComponentHandle {
  public readonly manager: EntityComponentManager;
  public readonly id: string;
  private readonly _store: Writable<Component>;
  private readonly _params: ComponentParamManager;

  constructor(
    manager: EntityComponentManager,
    componentId: string,
    params: Record<string, string>,
  ) {
    this.manager = manager;
    this._store = manager.entity.manager.scene.manager.ecs.components.get(componentId).store;
    this.id = componentId;
    this._params = new ComponentParamManager(this, params);
  }

  get store() {
    return this._store;
  }

  get params(): ComponentParamManager {
    return this._params;
  }

  delete() {
    this.manager.delete(this.id);
  }
}
