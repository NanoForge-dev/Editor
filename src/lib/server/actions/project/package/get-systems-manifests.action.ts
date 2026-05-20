import type { EditorSystemManifest } from '@nanoforge-dev/ecs-lib';

import { useActionHandler } from '@utils-server/request-handler';

class GetSystemManifestBody {
  systemPaths!: [string, ...string[]];
}

export const getSystemsManifestsAction = useActionHandler(
  async ({ body, project }): Promise<EditorSystemManifest[]> => {
    return await Promise.all(
      body.systemPaths.map((path) => project.client.package.getSystemManifest(path)),
    );
  },
  {
    body: GetSystemManifestBody,
  },
);
