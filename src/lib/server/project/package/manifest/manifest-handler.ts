import { join } from 'path';

import { FileSystemError } from '$lib/server/file-system/file-system-error';
import type { ProjectHandler } from '$lib/server/project';

import { PACKAGES_PATH, PACKAGES_PATH_FORMATTER } from '../package.const';
import { PackageTypeEnum } from '../package.enum';
import type { ManifestPackage, PackageType } from '../package.type';
import { resolveManifest } from './manifest-resolver';

const resolveSave = <T extends ManifestPackage>(
  type: T,
  name: string,
  path: string,
  manifest: PackageType<T>['manifest'],
): PackageType<T>['save'] => {
  const base = { name, path };
  if (type === PackageTypeEnum.SYSTEM) return base;
  return {
    ...base,
    paramsNames: (manifest as PackageType<PackageTypeEnum.COMPONENT>['manifest']).params.map(
      ({ name }) => name,
    ),
  };
};

export class ManifestHandler {
  private readonly handler: ProjectHandler;

  constructor(handler: ProjectHandler) {
    this.handler = handler;
  }

  resolveFromName<T extends ManifestPackage>(type: T, rawName: string): PackageType<T> {
    return this.resolveFromFilename(type, PACKAGES_PATH_FORMATTER[type](rawName));
  }

  resolveFromFilename<T extends ManifestPackage>(type: T, filename: string): PackageType<T> {
    const path = join(PACKAGES_PATH[type], filename);

    return this.resolveFromPath(type, path);
  }

  resolveFromPath<T extends ManifestPackage>(type: T, path: string): PackageType<T> {
    const manifest = this._resolveManifest(type, path);

    return {
      manifest,
      save: resolveSave(type, manifest.id, path, manifest),
    } as PackageType<T>;
  }

  private _resolveManifest<T extends ManifestPackage>(
    type: T,
    path: string,
  ): PackageType<T>['manifest'] {
    return this._findPackageManifest((p) => this._getPackageManifest(type, p), path);
  }

  private _getPackageManifest<T extends ManifestPackage>(
    type: T,
    path: string,
  ): PackageType<T>['manifest'] {
    const content = this.handler._rootFs.getFile(this._resolvePartPath(path)).read();
    return resolveManifest(type, content);
  }

  private _findPackageManifest<T extends ManifestPackage>(
    manifestGetter: (path: string) => PackageType<T>['manifest'],
    path: string,
  ): PackageType<T>['manifest'] {
    const manifest = ['', '.ts', '.js'].reduce(
      (result: PackageType<T>['manifest'] | undefined, p) => {
        if (result) return result;

        try {
          return manifestGetter(path + p);
        } catch (e) {
          if (!(e instanceof FileSystemError)) throw e;
        }
      },
      undefined,
    );

    if (!manifest) {
      throw new FileSystemError("Can't find package manifest");
    }
    return manifest;
  }

  private _resolvePartPath(path: string): string {
    return join(this.handler._part, path);
  }
}
