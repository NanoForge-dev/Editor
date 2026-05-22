import type { NewSystemPackage } from '$lib/server/project/package/package.type';

import { useActionHandler } from '@utils-server/request-handler';

export class CreateSystemBody {
  systemName!: string;
}

export const createSystemProjectAction = useActionHandler(
  async ({ body, project }): Promise<NewSystemPackage> => {
    return project.client.package.createSystem(body.systemName);
  },
  {
    body: CreateSystemBody,
  },
);
