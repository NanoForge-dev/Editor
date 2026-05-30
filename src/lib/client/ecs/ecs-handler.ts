import {
  componentsTransformer,
  scenesTransformer,
  systemsTransformer,
} from '$lib/client/ecs/transformers';
import type { Project } from '$lib/client/project';

import { ComponentManager } from './component/component-manager';
import { SceneManager } from './scene/scene-manager';
import { SystemManager } from './system/system-manager';

export class ECSHandler {
  private readonly _project: Project;

  private _sceneManager: SceneManager | undefined;
  private _componentManager: ComponentManager | undefined;
  private _systemManager: SystemManager | undefined;

  constructor(project: Project) {
    this._project = project;
  }

  async init() {
    /**
     * @todo
     * This init is only made for the current version of the editor
     * When scenes will be implemented, this init must be changed accordingly
     */

    const components = await this._project.actions.package.getComponents();
    const systems = await this._project.actions.package.getSystems();
    // Cannot use save handler as it needs to use ecs handler to subscribe to ecs changes
    const save = await this._project.actions.save.get();

    this._componentManager = new ComponentManager(componentsTransformer(components));
    this._systemManager = new SystemManager(systemsTransformer(systems));
    // Scene Manager needs others managers to be initialized
    this._sceneManager = new SceneManager(this, scenesTransformer(save), 'default');
  }

  get scenes(): SceneManager {
    if (!this._sceneManager) throw new Error('ECS handler not initialized');
    return this._sceneManager;
  }

  get components(): ComponentManager {
    if (!this._componentManager) throw new Error('ECS handler not initialized');
    return this._componentManager;
  }

  get systems(): SystemManager {
    if (!this._systemManager) throw new Error('ECS handler not initialized');
    return this._systemManager;
  }
}
