import type { NewSystemPackage } from '$lib/server/project/package/package.type';

import { useActionHandler } from '@utils-server/request-handler';

class AddSystemBody {
  systemNames!: [string, ...string[]];
}

export const addSystemsProjectAction = useActionHandler(
  async ({ body, project }): Promise<NewSystemPackage[]> => {
    return await Promise.all(
      body.systemNames.map((systemName) => project.client.package.installSystem(systemName)),
    );
  },
  {
    body: AddSystemBody,
  },
);
