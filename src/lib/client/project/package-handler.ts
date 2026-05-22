import type { EditorComponentManifest, EditorSystemManifest } from '@nanoforge-dev/ecs-lib';

import type { Project } from '$lib/client/project';

export class PackageHandler {
  private _project: Project;

  private _componentsManifests: Map<string, EditorComponentManifest> = new Map();
  private _systemsManifests: Map<string, EditorSystemManifest> = new Map();

  constructor(project: Project) {
    this._project = project;
  }

  async init() {
    if (this._project.save.save.components.length > 0) {
      this._componentsManifests = new Map<string, EditorComponentManifest>(
        (
          await this._project.actions.package.getComponentsManifests({
            componentPaths: this._project.save.save.components.map((c) => c.path),
          })
        ).map((e, index) => [this._project.save.save.components[index].name, e]),
      );
    }
    if (this._project.save.save.systems.length > 0) {
      this._systemsManifests = new Map<string, EditorSystemManifest>(
        (
          await this._project.actions.package.getSystemsManifests({
            systemPaths: this._project.save.save.systems.map((s) => s.path),
          })
        ).map((e, index) => [this._project.save.save.systems[index].name, e]),
      );
    }
  }

  getComponentManifest(componentName: string): EditorComponentManifest | undefined {
    return this._componentsManifests.get(componentName);
  }

  getSystemManifest(systemName: string): EditorSystemManifest | undefined {
    return this._systemsManifests.get(systemName);
  }

  async installComponent(name: string): Promise<void> {
    const newComponent = (
      await this._project.actions.package.addComponents({ componentNames: [name] })
    )[0];

    this._project.save.save.components.push(newComponent.save);
    this._componentsManifests.set(newComponent.save.name, newComponent.manifest);
  }

  async installSystem(name: string): Promise<void> {
    const newSystem = (await this._project.actions.package.addSystems({ systemNames: [name] }))[0];

    this._project.save.save.systems.push(newSystem.save);
    this._systemsManifests.set(newSystem.save.name, newSystem.manifest);
  }

  addComponentManifest(componentName: string, component: EditorComponentManifest) {
    this._componentsManifests.set(componentName, component);
  }

  addSystemManifest(systemName: string, system: EditorSystemManifest) {
    this._systemsManifests.set(systemName, system);
  }
}
