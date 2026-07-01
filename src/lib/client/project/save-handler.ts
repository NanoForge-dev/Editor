import { type Writable, get, writable } from 'svelte/store';

import { getConfig } from '$lib/client/config';
import { CoreEvents } from '$lib/client/event';
import type { Project } from '$lib/client/project';

import type { Save } from '@utils/types';

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
  private _needSync: Writable<boolean> = writable(false);
  private _syncGatewayEnable?: boolean = true;

  constructor(project: Project) {
    this._project = project;
  }

  async init() {
    await this.fetchFromServer();

    this._listeners();

    this._save.subscribe(() => {
      this.syncToServer();
      this._project.event.emit(CoreEvents.HOT_RELOAD, this.save);
    });
    if (getConfig().mode === 'online') {
      this.initSyncGateway();
    }
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
        if (get(this._needSync)) {
          this.syncToServer();
          this._needSync.set(false);
        }
      }, 5000);
    } else {
      this._needSync.set(true);
    }
  }

  async forceSyncToServer() {
    this._readyToSync = true;
    this._needSync.set(false);
    clearTimeout(this._syncTimer);
    await this.syncToServer();
  }

  get save(): Save {
    return get(this._save);
  }

  private _listeners() {
    this._project.ecs.components.store.subscribe((components) => {
      this._save.set({
        ...this.save,
        components: components.map((component) => ({
          name: component.id,
          path: component.path,
          paramsNames: component.params.map((p) => {
            if (p.type === 'asset') return `__RESERVED_ASSET_${p.name}`;
            return p.name;
          }),
        })),
      });
      void this.forceSyncToServer();
    });

    this._project.ecs.scenes.activeData.systems.store.subscribe((systems) => {
      this._save.set({
        ...this.save,
        systems: systems.map((id) => {
          const system = this._project.ecs.systems.get(id).data;
          return {
            name: system.id,
            path: system.path,
          };
        }),
      });
      void this.forceSyncToServer();
    });

    this._project.ecs.scenes.activeData.entities.store.subscribe((entities) => {
      this._save.set({
        ...this.save,
        entities: entities.map((entity) => ({
          id: entity.id,
          treePath: entity.treePath,
          components: entity.components,
        })),
      });
      void this.syncToServer();
    });
  }

  private initSyncGateway() {
    setInterval(
      async () => {
        if (this._syncGatewayEnable) {
          await this._project.actions.project.syncGatewayProject();
        }
      },
      1000 * 60 * 5,
    );
    window.addEventListener('beforeunload', (e) => {
      const res = this._project.actions.project.syncGatewayProject();
      if (!res) e.preventDefault();
    });
  }
}
