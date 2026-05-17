import type { NewComponentPackage } from '$lib/server/project/package/package.type';

import { useActionHandler } from '@utils-server/request-handler';

class CreateComponentBody {
  componentName!: string;
}

export const createComponentProjectAction = useActionHandler(
  async ({ body, project }): Promise<NewComponentPackage> => {
    return project.client.package.createComponent(body.componentName);
  },
  {
    body: CreateComponentBody,
  },
);
