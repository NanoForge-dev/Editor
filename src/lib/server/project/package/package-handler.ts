import type { EditorComponentManifest, EditorSystemManifest } from '@nanoforge-dev/ecs-lib';
import { join } from 'path';

import { FileSystemError } from '$lib/server/file-system/file-system-error';
import type { DirectoryContent } from '$lib/server/file-system/project-directory';
import { type ProjectHandler } from '$lib/server/project';

import { formatFrom } from '@utils/format';

import { resolveManifest } from './manifest-resolver';
import { type ComponentPackage, PackageTypeEnum, type SystemPackage } from './package.type';

export class PackageHandler {
  private readonly handler: ProjectHandler;

  constructor(handler: ProjectHandler) {
    this.handler = handler;
  }

  async installComponent(name: string): Promise<ComponentPackage> {
    const rc = await this.handler._api.registry.getPackage(name);
    if (rc.type !== 'component') throw new Error(`Can only add component: ${name} is a ${rc.type}`);
    this.handler._cli.install([name], { server: this.handler._part === 'server' || undefined });

    return this._getNewComponentPackage(rc.name, rc._file);
  }

  async installSystem(name: string): Promise<SystemPackage> {
    const rs = await this.handler._api.registry.getPackage(name);
    if (rs.type !== 'system') throw new Error(`Can only add system: ${name} is a ${rs.type}`);
    this.handler._cli.install([name], { server: this.handler._part === 'server' || undefined });

    return this._getNewSystemPackage(rs.name, rs._file);
  }

  /**
   * Create a new component in the project
   * @beta function to be reworked
   *
   * @param {string} name - Name of the component
   */
  createComponent(name: string): ComponentPackage {
    this._createPackage(PackageTypeEnum.COMPONENT, name);
    return this._getNewComponentPackage(
      formatFrom.all(name).toPascal() + 'Component',
      formatFrom.all(name).toKebab() + '.component',
    );
  }

  /**
   * Create a new system in the project and update the save file
   * @beta function to be reworked
   *
   * @param {string} name - Name of the system
   */
  createSystem(name: string): SystemPackage {
    this._createPackage(PackageTypeEnum.SYSTEM, name);
    return this._getNewSystemPackage(
      formatFrom.all(name).toCamel() + 'System',
      formatFrom.all(name).toKebab() + '.system',
    );
  }

  /**
   * Get the manifest of the component
   * @beta function to be reworked
   *
   * @param {string} path - Path from `/<client|server>`
   *
   * @returns Manifest of the component
   */
  getComponentManifest(path: string): EditorComponentManifest {
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
  getSystemManifest(path: string): EditorSystemManifest {
    return this._getPackageManifest(PackageTypeEnum.SYSTEM, path);
  }

  async getComponents(): Promise<ComponentPackage[]> {
    return this._resolvesPackages(PackageTypeEnum.COMPONENT);
  }

  async getSystems(): Promise<SystemPackage[]> {
    return this._resolvesPackages(PackageTypeEnum.SYSTEM);
  }

  private _resolvesPackages<T extends PackageTypeEnum>(
    type: T,
  ): (T extends PackageTypeEnum.COMPONENT ? ComponentPackage : SystemPackage)[] {
    const basePath = type === PackageTypeEnum.COMPONENT ? './components' : './systems';
    const dir = this.handler.fs.getDirectory(basePath);
    const content = dir.read(true);
    const paths = this._resolvesPackageFilesPathFromContent(content);
    return paths.map((path) => this._resolvesPackage<T>(type, join(basePath, path)));
  }

  private _resolvesPackage<T extends PackageTypeEnum>(
    type: T,
    path: string,
  ): T extends PackageTypeEnum.COMPONENT ? ComponentPackage : SystemPackage {
    const manifest = this._getPackageManifest(type, path);
    const res: any = {
      manifest,
      save: {
        name: manifest.name,
        path,
      },
    };
    if (type === PackageTypeEnum.COMPONENT) {
      res.save.params = manifest.params.map(({ name }: { name: string }) => name);
    }
    return res;
  }

  private _resolvesPackageFilesPathFromContent(
    content: DirectoryContent,
    path: string = '',
  ): string[] {
    const files = content.files.map((file) => join(path, file));
    const directories = Object.entries(content.directories).map(([key, value]) => {
      if (!value) return [];
      return this._resolvesPackageFilesPathFromContent(value, join(path, key)).filter(Boolean);
    });

    return [...files, ...directories.flat()];
  }

  private _getNewComponentPackage(name: string, fileName: string): ComponentPackage {
    const path = `./components/${fileName}`;

    const manifest = this._findPackageManifest(this.getComponentManifest, path);

    return {
      manifest,
      save: {
        name,
        path,
        paramsNames: manifest.params.map(({ name }) => name),
      },
    };
  }

  private _getNewSystemPackage(name: string, fileName: string): SystemPackage {
    const path = `./systems/${fileName}`;
    return {
      manifest: this._findPackageManifest(this.getSystemManifest, path),
      save: { name, path },
    };
  }

  private _findPackageManifest<T>(manifestGetter: (path: string) => T, path: string): T {
    const manifest = ['', '.ts', '.js'].reduce((result: T | undefined, p) => {
      if (result) return result;

      try {
        return manifestGetter(path + p);
      } catch (e) {
        if (!(e instanceof FileSystemError)) throw e;
      }
    }, undefined);

    if (!manifest) {
      throw new FileSystemError("Can't find package manifest");
    }
    return manifest;
  }

  private _createPackage(type: PackageTypeEnum, name: string): void {
    this.handler._cli.create(type, {
      name,
      server: this.handler._part === 'server' || undefined,
    });
  }

  private _getPackageManifest(type: PackageTypeEnum, path: string): any {
    const content = this.handler._rootFs.getFile(this._resolvePartPath(path)).read();
    return resolveManifest(type, content);
  }

  private _resolvePartPath(path: string): string {
    return join(this.handler._part, path);
  }
}
