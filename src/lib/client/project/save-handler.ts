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
      console.log('set save');
      await this._project.actions.save.set({ save: get(this._save) });
    }
    setTimeout(() => {
      this._readyToSync = true;
    }, 100);
  }

  get save(): Save {
    return get(this._save);
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
