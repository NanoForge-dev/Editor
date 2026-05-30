import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import type { ECSHandler } from '../ecs-handler';
import { SceneHandle } from './scene-handle';
import type { Scene } from './scene.type';

export class SceneManager {
  public readonly ecs: ECSHandler;
  private readonly _store: Writable<Scene[]>;
  private readonly _subscriptions: Record<string, Unsubscriber> = {};
  private _activeScene: SceneHandle;

  constructor(ecs: ECSHandler, scenes: Scene[], defaultSceneId: string) {
    this.ecs = ecs;
    this._store = writable<Scene[]>(scenes);

    const defaultScene = scenes.find((scene) => scene.id === defaultSceneId);
    if (!defaultScene) throw new Error(`Default scene with id ${defaultSceneId} not found`);
    this._activeScene = new SceneHandle(this, defaultScene);
  }

  get store() {
    return this._store;
  }

  get activeScene(): SceneHandle {
    return this._activeScene;
  }

  set activeScene(handle: SceneHandle) {
    this._activeScene = handle;
  }

  add(scene: Scene) {
    const scenes = get(this._store);
    scenes.push(scene);
    this._store.set(scenes);
  }

  get(id: string) {
    const scene = get(this._store).find((scene) => scene.id === id);
    if (!scene) throw new Error(`Scene with id ${id} not found`);

    const handle = new SceneHandle(this, scene);
    this._subscriptions[id] = handle.store.subscribe((scene) => this._update(id, scene));

    return handle;
  }

  delete(id: string) {
    const scenes = get(this._store);
    this._store.set(scenes.filter((scene) => scene.id !== id));

    if (id in this._subscriptions) this._subscriptions[id]();
  }

  private _update(id: string, scene: Scene) {
    const scenes = get(this._store);
    const index = scenes.findIndex((s) => s.id === id);
    if (index === -1) return;
    scenes[index] = scene;
    this._store.set(scenes);
  }
}
