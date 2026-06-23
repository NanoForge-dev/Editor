import type { Project } from '$lib/client/project';

export class PackageHandler {
  private readonly _project: Project;

  constructor(project: Project) {
    this._project = project;
  }

  async installPackages(names: [string, ...string[]]): Promise<void> {
    await this._project.actions.package.installPackages({ names });

    // installPackages does not return dependencies, so it's required to sync to fetch all new components/systems
    await this._project.ecs.components.sync();
    await this._project.ecs.systems.sync();

    const dir = await this._project.fs.getDirectory();
    await dir.readdir(true);
  }
}
