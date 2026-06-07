import type { ComponentManifest } from '$lib/server/project/package';

import { useActionHandler } from '@utils-server/request-handler';

export class GetComponentManifestBody {
  componentPaths!: [string, ...string[]];
}

export const getComponentsManifestsAction = useActionHandler(
  async ({ body, project }): Promise<ComponentManifest[]> => {
    return await Promise.all(
      body.componentPaths.map((path) => project.client.package.getComponentManifest(path)),
    );
  },
  {
    body: GetComponentManifestBody,
  },
);
