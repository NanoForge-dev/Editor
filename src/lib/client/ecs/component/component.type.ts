import type { EditorComponentManifest } from '@nanoforge-dev/ecs-lib';

export type ComponentParam = EditorComponentManifest['params'][number];

export interface Component {
  id: string;
  name: string;
  path: string;
  params: ComponentParam[];
}
