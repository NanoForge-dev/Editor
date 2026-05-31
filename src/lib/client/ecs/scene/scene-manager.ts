import { type Unsubscriber, type Writable, get, writable } from 'svelte/store';

import type { ECSHandler } from '../ecs-handler';
import { resetSubscriptions } from '../utils';
import { SceneHandle } from './scene-handle';
import type { Scene } from './scene.type';

const _storage = writable<Scene[]>([]);
const _rootScenesStorage = writable<string[]>([]);
const _activeSceneStorage = writable<SceneHandle>();
const _defaultSceneStorage = writable<string>();

const _subscriptions = writable<Record<string, Unsubscriber | null>>({});

export class SceneManager {
  public readonly ecs: ECSHandler;

  static reset() {
    _storage.set([]);
    _rootScenesStorage.set([]);
    _activeSceneStorage.set(undefined as any);
    _defaultSceneStorage.set(undefined as any);
    resetSubscriptions(_subscriptions);
  }

  constructor(ecs: ECSHandler, scenes: Scene[], rootScenes: string[], defaultSceneId: string) {
    this.ecs = ecs;
    _storage.set(scenes);

    const defaultScene = scenes.find((scene) => scene.id === defaultSceneId);
    if (!defaultScene) throw new Error(`Default scene with id ${defaultSceneId} not found`);

    _activeSceneStorage.set(new SceneHandle(this, defaultScene));
    _defaultSceneStorage.set(defaultSceneId);
    _rootScenesStorage.set(rootScenes);
  }

  get store() {
    return _storage;
  }

  get data() {
    return get(_storage);
  }

  get activeData(): SceneHandle {
    return get(_activeSceneStorage);
  }

  get active(): Writable<SceneHandle> {
    return _activeSceneStorage;
  }

  set active(handle: SceneHandle) {
    _activeSceneStorage.set(handle);
  }

  get defaultData(): string {
    return get(_defaultSceneStorage);
  }

  get default(): Writable<string> {
    return _defaultSceneStorage;
  }

  set default(handle: string) {
    _defaultSceneStorage.set(handle);
  }

  get rootScenes(): string[] {
    return get(_rootScenesStorage);
  }

  get rootScenesStore(): Writable<string[]> {
    return _rootScenesStorage;
  }

  set rootScenes(scenes: string[]) {
    _rootScenesStorage.set(scenes);
  }

  add(scene: Scene) {
    const scenes = get(_storage);
    scenes.push(scene);
    _storage.set(scenes);
  }

  get(id: string): SceneHandle {
    const scene = get(_storage).find((scene) => scene.id === id);
    if (!scene) throw new Error(`Scene with id ${id} not found`);
    const handle = new SceneHandle(this, scene);

    this._subscribe(id, handle);

    return handle;
  }

  delete(id: string) {
    const scenes = get(_storage);
    _storage.set(scenes.filter((scene) => scene.id !== id));

    const subscriptions = get(_subscriptions);
    if (subscriptions[id]) {
      subscriptions[id]();
      subscriptions[id] = null;
      _subscriptions.set(subscriptions);
    }
  }

  private _subscribe(id: string, handle: SceneHandle) {
    setTimeout(() => {
      const subscriptions = get(_subscriptions);
      if (subscriptions[id]) return;
      subscriptions[id] = handle.store.subscribe((scene) => this._update(id, scene));
      _subscriptions.set(subscriptions);
    }, 0);
  }

  private _update(id: string, scene: Scene) {
    const scenes = get(_storage);
    const index = scenes.findIndex((s) => s.id === id);
    if (index === -1) return;
    scenes[index] = scene;
    _storage.set(scenes);
  }
}
