import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import type { ECSHandler } from '../ecs-handler';
import { SceneHandle } from './scene-handle';
import type { Scene } from './scene.type';

export class SceneManager {
  public readonly ecs: ECSHandler;
  private readonly _store: Writable<Scene[]>;
  private readonly _rootScenes: Writable<string[]>;
  private readonly _subscriptions: Record<string, Unsubscriber> = {};
  private readonly _activeScene: Writable<SceneHandle>;
  private readonly _defaultScene: Writable<string>;

  constructor(ecs: ECSHandler, scenes: Scene[], rootScenes: string[], defaultSceneId: string) {
    this.ecs = ecs;
    this._store = writable<Scene[]>(scenes);

    const defaultScene = scenes.find((scene) => scene.id === defaultSceneId);
    if (!defaultScene) throw new Error(`Default scene with id ${defaultSceneId} not found`);
    this._activeScene = writable(new SceneHandle(this, defaultScene));
    this._defaultScene = writable(defaultSceneId);
    this._rootScenes = writable(rootScenes);
  }

  get store() {
    return this._store;
  }

  get data() {
    return get(this._store);
  }

  get active(): SceneHandle {
    return get(this._activeScene);
  }

  get activeStore(): Writable<SceneHandle> {
    return this._activeScene;
  }

  set active(handle: SceneHandle) {
    this._activeScene.set(handle);
  }

  get default(): string {
    return get(this._defaultScene);
  }

  get defaultStore(): Writable<string> {
    return this._defaultScene;
  }

  set default(handle: string) {
    this._defaultScene.set(handle);
  }

  get rootScenes(): string[] {
    return get(this._rootScenes);
  }

  get rootScenesStore(): Writable<string[]> {
    return this._rootScenes;
  }

  set rootScenes(scenes: string[]) {
    this._rootScenes.set(scenes);
  }

  add(scene: Scene) {
    const scenes = get(this._store);
    scenes.push(scene);
    this._store.set(scenes);
  }

  get(id: string): SceneHandle {
    const scene = get(this._store).find((scene) => scene.id === id);
    if (!scene) throw new Error(`Scene with id ${id} not found`);
    const handle = new SceneHandle(this, scene);

    this._subscribe(id, handle);

    return handle;
  }

  delete(id: string) {
    const scenes = get(this._store);
    this._store.set(scenes.filter((scene) => scene.id !== id));

    if (id in this._subscriptions) this._subscriptions[id]();
  }

  private _subscribe(id: string, handle: SceneHandle) {
    setTimeout(() => {
      this._subscriptions[id] = handle.store.subscribe((scene) => this._update(id, scene));
    }, 0);
  }

  private _update(id: string, scene: Scene) {
    const scenes = get(this._store);
    const index = scenes.findIndex((s) => s.id === id);
    if (index === -1) return;
    scenes[index] = scene;
    this._store.set(scenes);
  }
}
