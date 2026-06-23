import type { EditorComponentManifest, EditorSystemManifest } from '@nanoforge-dev/ecs-lib';

import type { SaveComponent, SaveSystem } from '@utils/types';

export enum PackageTypeEnum {
  COMPONENT = 'component',
  SYSTEM = 'system',
}

export type ComponentManifest = EditorComponentManifest & {
  id: string;
  type: PackageTypeEnum.COMPONENT;
};
export type SystemManifest = EditorSystemManifest & { id: string; type: PackageTypeEnum.SYSTEM };

export interface ComponentPackage {
  manifest: ComponentManifest;
  save: SaveComponent;
}

export interface SystemPackage {
  manifest: SystemManifest;
  save: SaveSystem;
}
