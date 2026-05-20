import type { EditorComponentManifest, EditorSystemManifest } from '@nanoforge-dev/ecs-lib';

import type { Project } from '$lib/client/project';

export class PackageHandler {
  private _project: Project;

  private _componentsManifests: EditorComponentManifest[] = [];
  private _systemsManifests: EditorSystemManifest[] = [];

  constructor(project: Project) {
    this._project = project;
  }

  async init() {
    if (this._project.save.save.components.length > 0) {
      await this._project.actions.project.getComponentsManifests({
        componentPaths: this._project.save.save.components.map((c) => c.path),
      });
    }
    if (this._project.save.save.systems.length > 0) {
      await this._project.actions.project.getSystemsManifests({
        systemPaths: this._project.save.save.systems.map((s) => s.path),
      });
    }
  }

  get componentsManifests(): EditorComponentManifest[] {
    return this._componentsManifests;
  }

  get systemsManifests(): EditorSystemManifest[] {
    return this._systemsManifests;
  }

  async installComponent(name: string): Promise<void> {
    const newComponent = (
      await this._project.actions.project.addComponents({ componentNames: [name] })
    )[0];

    this._project.save.save.components.push(newComponent.save);
    this._componentsManifests.push(newComponent.manifest);
  }

  async installSystem(name: string): Promise<void> {
    const newSystem = (await this._project.actions.project.addSystems({ systemNames: [name] }))[0];

    this._project.save.save.systems.push(newSystem.save);
    this._systemsManifests.push(newSystem.manifest);
  }

  addComponentManifest(component: EditorComponentManifest) {
    this._componentsManifests.push(component);
  }

  addSystemManifest(system: EditorSystemManifest) {
    this._systemsManifests.push(system);
  }
}
