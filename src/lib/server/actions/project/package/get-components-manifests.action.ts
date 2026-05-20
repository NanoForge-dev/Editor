import type { EditorComponentManifest } from '@nanoforge-dev/ecs-lib';

import { useActionHandler } from '@utils-server/request-handler';

class GetComponentManifestBody {
  componentPaths!: [string, ...string[]];
}

export const getComponentsManifestsAction = useActionHandler(
  async ({ body, project }): Promise<EditorComponentManifest[]> => {
    return await Promise.all(
      body.componentPaths.map((path) => project.client.package.getComponentManifest(path)),
    );
  },
  {
    body: GetComponentManifestBody,
  },
);
