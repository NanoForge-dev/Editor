import type { EditorComponentManifest, EditorSystemManifest } from '@nanoforge-dev/ecs-lib';

import { type PackageTypeEnum } from '../package.enum';

export type ComponentManifest = EditorComponentManifest & {
  id: string;
  type: PackageTypeEnum.COMPONENT;
};
export type SystemManifest = EditorSystemManifest & { id: string; type: PackageTypeEnum.SYSTEM };
