import {
  assetsTransformer,
  componentsTransformer,
  librariesTransformer,
  scenesTransformer,
  systemsTransformer,
} from '$lib/client/ecs/transformers';
import type { Project } from '$lib/client/project';

import { AssetHandle } from './asset/asset-handle';
import { AssetManager } from './asset/asset-manager';
import { ComponentHandle } from './component/component-handle';
import { ComponentManager } from './component/component-manager';
import { LibraryHandle } from './library/library-handle';
import { LibraryManager } from './library/library-manager';
import { EntityComponentManager } from './scene/entity/component/component-manager';
import { ComponentParamHandle } from './scene/entity/component/component-param-handle';
import { ComponentParamManager } from './scene/entity/component/component-param-manager';
import { SceneEntityHandle } from './scene/entity/entity-handle';
import { SceneEntityManager } from './scene/entity/entity-manager';
import { SceneHandle } from './scene/scene-handle';
import { SceneManager } from './scene/scene-manager';
import { SceneSystemManager } from './scene/system/system-manager';
import { SystemHandle } from './system/system-handle';
import { SystemManager } from './system/system-manager';

export class ECSHandler {
  private readonly _project: Project;

  private _sceneManager: SceneManager | undefined;
  private _assetManager: AssetManager | undefined;
  private _componentManager: ComponentManager | undefined;
  private _systemManager: SystemManager | undefined;
  private _libraryManager: LibraryManager | undefined;

  static reset() {
    // * Child must be reset before parents
    ComponentParamHandle.reset();
    ComponentParamManager.reset();
    EntityComponentManager.reset();
    SceneSystemManager.reset();
    SceneEntityHandle.reset();
    SceneEntityManager.reset();
    AssetHandle.reset();
    AssetManager.reset();
    ComponentHandle.reset();
    ComponentManager.reset();
    SystemManager.reset();
    SystemHandle.reset();
    LibraryManager.reset();
    LibraryHandle.reset();
    SceneHandle.reset();
    SceneManager.reset();
  }

  constructor(project: Project) {
    this._project = project;
  }

  async init() {
    /**
     * @todo
     * This init is only made for the current version of the editor
     * When scenes will be implemented, this init must be changed accordingly
     */

    const assets = await this._project.actions.package.getAssets();
    const components = await this._project.actions.package.getComponents();
    const systems = await this._project.actions.package.getSystems();
    // Cannot use save handler as it needs to use ecs handler to subscribe to ecs changes
    const save = await this._project.actions.save.get();

    this._assetManager = new AssetManager(assetsTransformer(assets));
    this._componentManager = new ComponentManager(componentsTransformer(components));
    this._systemManager = new SystemManager(systemsTransformer(systems));
    this._libraryManager = new LibraryManager(librariesTransformer(save));
    // Scene Manager needs others managers to be initialized
    this._sceneManager = new SceneManager(this, scenesTransformer(save), ['default'], 'default');
  }

  get scenes(): SceneManager {
    if (!this._sceneManager) throw new Error('ECS handler not initialized');
    return this._sceneManager;
  }

  get assets(): AssetManager {
    if (!this._assetManager) throw new Error('ECS handler not initialized');
    return this._assetManager;
  }

  get components(): ComponentManager {
    if (!this._componentManager) throw new Error('ECS handler not initialized');
    return this._componentManager;
  }

  get systems(): SystemManager {
    if (!this._systemManager) throw new Error('ECS handler not initialized');
    return this._systemManager;
  }

  get libraries(): LibraryManager {
    if (!this._libraryManager) throw new Error('ECS handler not initialized');
    return this._libraryManager;
  }
}
