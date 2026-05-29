import type { EditorComponentManifest } from '@nanoforge-dev/ecs-lib';
import { type Writable, get, writable } from 'svelte/store';

import type { Project } from '$lib/client/project';

import type { Save, SaveComponent, SaveEntity, SaveSystem } from '@utils/types';

export class SaveHandler {
  private _project: Project;
  private _save: Writable<Save> = writable({
    libraries: [],
    entities: [],
    components: [],
    systems: [],
  });
  private _readyToSync = true;
  private _syncTimer?: Timer;
  private _needSync: boolean = $state(false);

  constructor(project: Project) {
    this._project = project;
  }

  async init() {
    await this.fetchFromServer();
    this._save.subscribe(() => {
      this.syncToServer();
    });
  }

  async fetchFromServer() {
    this._save.set(await this._project.actions.save.get());
  }

  async syncToServer() {
    if (this._readyToSync) {
      this._readyToSync = false;

      await this._project.actions.save.set({ save: get(this._save) });

      this._syncTimer = setTimeout(() => {
        this._readyToSync = true;
        if (this._needSync) {
          this.syncToServer();
        }
      }, 5000);
    } else {
      this._needSync = true;
    }
  }

  async forceSyncToServer() {
    this._readyToSync = true;
    this._needSync = false;
    clearTimeout(this._syncTimer);
    await this.syncToServer();
  }

  get save(): Save {
    return get(this._save);
  }

  get needSync(): boolean {
    return this._needSync;
  }

  addComponent(component: SaveComponent) {
    get(this._save).components.push(component);
  }

  addEntity(entity: SaveEntity) {
    get(this._save).entities.push(entity);
  }

  addSystem(system: SaveSystem) {
    get(this._save).systems.push(system);
  }

  addComponentToEntity(
    entityId: string,
    componentName: string,
    componentManifest: EditorComponentManifest,
  ) {
    const entity = get(this._save).entities.find((e) => e.id === entityId);
    if (!entity) {
      throw new Error('Entity not found: ' + entityId);
    }
    const newComp: Record<string, any> = {};
    componentManifest.params.forEach((c) => (newComp[c.name] = c.default));
    entity.components[componentName] = newComp;
  }
}
