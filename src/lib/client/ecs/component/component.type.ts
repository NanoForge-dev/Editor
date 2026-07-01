import type { ComponentManifest } from '$lib/server/project/package/manifest/manifest.type';

export type ComponentParam = ComponentManifest['params'][number];

export interface Component {
  id: string;
  name: string;
  path: string;
  params: ComponentParam[];
}
