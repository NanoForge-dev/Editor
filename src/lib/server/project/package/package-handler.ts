import { join } from 'path';

import type { DirectoryContent } from '$lib/server/file-system/project-directory';
import type { ProjectHandler } from '$lib/server/project';

import { ManifestHandler } from './manifest/manifest-handler';
import { PACKAGES_PATH } from './package.const';
import { PackageTypeEnum } from './package.enum';
import type {
  AssetPackage,
  ComponentPackage,
  CreatablePackage,
  PackageType,
  SystemPackage,
} from './package.type';

export class PackageHandler {
  private readonly handler: ProjectHandler;
  private readonly manifestHandler: ManifestHandler;

  constructor(handler: ProjectHandler) {
    this.handler = handler;
    this.manifestHandler = new ManifestHandler(handler);
  }

  async installPackages(names: [string, ...string[]]): Promise<PackageType[]> {
    if (names.length === 0) return [];
    this.handler._cli.install(names, { server: this.handler._part === 'server' || undefined });

    return Promise.all(
      names.map(async (name) => {
        const r = await this.handler._api.registry.getPackage(name);
        return this._resolvesPackage(r.type, r._file);
      }),
    );
  }

  createComponent(name: string): ComponentPackage {
    this._createPackage(PackageTypeEnum.COMPONENT, name);
    return this.manifestHandler.resolveFromName(PackageTypeEnum.COMPONENT, name);
  }

  createSystem(name: string): SystemPackage {
    this._createPackage(PackageTypeEnum.SYSTEM, name);
    return this.manifestHandler.resolveFromName(PackageTypeEnum.SYSTEM, name);
  }

  async getComponents(): Promise<ComponentPackage[]> {
    return this._resolvesPackages(PackageTypeEnum.COMPONENT);
  }

  async getSystems(): Promise<SystemPackage[]> {
    return this._resolvesPackages(PackageTypeEnum.SYSTEM);
  }

  async getAssets(): Promise<AssetPackage[]> {
    return this._resolvesPackages(PackageTypeEnum.ASSET);
  }

  private _resolvesPackages<T extends PackageTypeEnum>(type: T): PackageType<T>[] {
    const basePath = PACKAGES_PATH[type];
    const dir = this.handler.fs.getDirectory(basePath);
    const content = dir.read(true, true);
    const paths = this._resolvesPackageFilesPathFromContent(content);
    return paths.map((path) => this._resolvesPackage<T>(type, path, basePath));
  }

  private _resolvesPackage<T extends PackageTypeEnum>(
    type: T,
    filename: string,
    basePath: string = PACKAGES_PATH[type],
  ): PackageType<T> {
    const path = join(basePath, filename);

    if (type === PackageTypeEnum.ASSET) return { path } as PackageType<T>;
    return this.manifestHandler.resolveFromPath(type, path) as PackageType<T>;
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

  private _createPackage(type: CreatablePackage, name: string): void {
    this.handler._cli.create(type, {
      name,
      server: this.handler._part === 'server' || undefined,
    });
  }
}
