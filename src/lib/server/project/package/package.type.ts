import type { SaveComponent, SaveSystem } from '@utils/types';

import type { ComponentManifest, SystemManifest } from './manifest/manifest.type';
import type { PackageTypeEnum } from './package.enum';

export interface ComponentPackage {
  manifest: ComponentManifest;
  save: SaveComponent;
}

export interface SystemPackage {
  manifest: SystemManifest;
  save: SaveSystem;
}

export interface AssetPackage {
  path: string;
}

export interface Packages {
  [PackageTypeEnum.COMPONENT]: ComponentPackage;
  [PackageTypeEnum.SYSTEM]: SystemPackage;
  [PackageTypeEnum.ASSET]: AssetPackage;
}

export type PackageType<T extends PackageTypeEnum | null = null> = T extends PackageTypeEnum
  ? Packages[T]
  : ComponentPackage | SystemPackage | AssetPackage;

export type ManifestPackage = PackageTypeEnum.COMPONENT | PackageTypeEnum.SYSTEM;
export type CreatablePackage = PackageTypeEnum.COMPONENT | PackageTypeEnum.SYSTEM;
