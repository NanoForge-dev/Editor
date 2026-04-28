import type { EditorComponentManifest } from '@nanoforge-dev/ecs-lib';
import { get } from 'svelte/store';

import { localApi } from '$lib/components/Utils/api/api';
import { save } from '$lib/components/Widget/EditorGame/game.svelte';
import type { SaveComponent } from '$lib/loader/client/types/save.type';

export async function createDefaultComponent(
  componentName: string,
  side: 'client' | 'server',
): Promise<[string, Record<string, any>]> {
  const savedComponent: SaveComponent[] = get(save).components;
  const componentToCreate = savedComponent?.find((c) => c.name === componentName);
  if (!componentToCreate) throw Error(`Can't create ${componentName}: not found`);
  const componentManifest: EditorComponentManifest = await localApi.getComponentManifest(
    componentToCreate.path,
    side,
  );

  const defaultParams: Record<string, any> = {};
  componentManifest.params.forEach((param) => {
    defaultParams[param.name] = param.default;
  });
  return [componentManifest.name, defaultParams];
}
