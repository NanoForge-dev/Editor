import { type Readable, get } from 'svelte/store';

import type { System } from '../../system/system.type';
import type { SceneSystemManager } from './system-manager';

export class SceneSystemHandle {
  public readonly manager: SceneSystemManager;
  public readonly id: string;
  private readonly _store: Readable<System>;

  constructor(manager: SceneSystemManager, systemId: string) {
    this.manager = manager;
    this.id = systemId;

    this._store = manager.scene.manager.ecs.systems.get(systemId).store;
  }

  get store() {
    return this._store;
  }

  get data() {
    return get(this._store);
  }

  delete() {
    this.manager.delete(this.id);
  }
}
