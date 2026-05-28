import { useProject } from '$lib/client/project';

import type { SaveComponent } from '@utils/types';

export async function createDefaultComponent(
  componentName: string,
): Promise<[string, Record<string, any>]> {
  const { save, packages } = useProject();
  const savedComponent: SaveComponent[] = save.save.components;
  const componentToCreate = savedComponent?.find((c) => c.name === componentName);
  if (!componentToCreate) throw Error(`Can't create ${componentName}: not found`);

  const componentManifest = packages.getComponentManifest(componentToCreate.path);

  if (!componentManifest) throw Error(`Can't create ${componentName}: not found`);

  const defaultParams: Record<string, any> = {};
  componentManifest.params.forEach((param) => {
    defaultParams[param.name] = param.default;
  });
  return [componentManifest.name, defaultParams];
}
