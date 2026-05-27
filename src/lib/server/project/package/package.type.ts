import type { EditorComponentManifest, EditorSystemManifest } from '@nanoforge-dev/ecs-lib';

import type { SaveComponent, SaveSystem } from '@utils/types';

export enum PackageTypeEnum {
  COMPONENT = 'component',
  SYSTEM = 'system',
}

export interface NewComponentPackage {
  manifest: EditorComponentManifest;
  save: SaveComponent;
}

export interface NewSystemPackage {
  manifest: EditorSystemManifest;
  save: SaveSystem;
}
