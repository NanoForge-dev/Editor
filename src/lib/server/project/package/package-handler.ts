import { join } from 'path';

import { type ProjectHandler } from '$lib/server/project';

import { toCamelCase, toKebabCase, toPascalCase } from '@utils/format';

import { resolveManifest } from './manifest-resolver';
import { PackageTypeEnum } from './package.type';

export class PackageHandler {
  private readonly handler: ProjectHandler;

  constructor(handler: ProjectHandler) {
    this.handler = handler;
  }

  /**
   * Create a new component in the project and update the save file
   * @beta function to be reworked
   *
   * @param {string} name - Name of the component
   * @param {string} [path=./components] - Path from `/<client|server>`
   */
  async createComponent(name: string, path: string = './components'): Promise<void> {
    const fullPath = this._createPackage(PackageTypeEnum.COMPONENT, name, path);
    const save = await this.handler.save.getSave();
    save.components = [
      ...save.components,
      {
        name: toPascalCase(name),
        path: join(fullPath, toKebabCase(name)),
        // Default params of the default component
        paramsNames: ['paramA', 'paramB', 'paramC'],
      },
    ];
    await this.handler.save.updateSave(save);
  }

  /**
   * Create a new system in the project and update the save file
   * @beta function to be reworked
   *
   * @param {string} name - Name of the system
   * @param {string} [path=./systems] - Path from `/<client|server>`
   */
  async createSystem(name: string, path: string = './systems'): Promise<void> {
    const fullPath = this._createPackage(PackageTypeEnum.SYSTEM, name, path);
    const save = await this.handler.save.getSave();
    save.systems = [
      ...save.systems,
      { name: toCamelCase(name), path: join(fullPath, toKebabCase(name)) },
    ];
    await this.handler.save.updateSave(save);
  }

  /**
   * Get the manifest of the component
   * @beta function to be reworked
   *
   * @param {string} path - Path from `/<client|server>`
   *
   * @returns Manifest of the component
   */
  getComponentManifest(path: string): any {
    return this._getPackageManifest(PackageTypeEnum.COMPONENT, path);
  }

  /**
   * Get the manifest of the system
   * @beta function to be reworked
   *
   * @param {string} path - Path from `/<client|server>`
   *
   * @returns Manifest of the system
   */
  getSystemManifest(path: string): any {
    return this._getPackageManifest(PackageTypeEnum.SYSTEM, path);
  }

  private _createPackage(type: PackageTypeEnum, name: string, path: string): string {
    const fullPath = this._resolvePartPath(path);
    this.handler._cli.create(type, {
      name,
      path: fullPath,
      server: this.handler._part === 'server' ? true : undefined,
    });
    return fullPath;
  }

  private _getPackageManifest(type: PackageTypeEnum, path: string): any {
    const content = this.handler._rootFs.getFile(this._resolvePartPath(path)).read();
    return resolveManifest(type, content);
  }

  private _resolvePartPath(path: string): string {
    return join(this.handler._part, path);
  }
}
