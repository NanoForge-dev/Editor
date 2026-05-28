import type { ComponentPackage } from '$lib/server/project/package';

import { useActionHandler } from '@utils-server/request-handler';

export const getComponentsAction = useActionHandler(
  async ({ project }): Promise<ComponentPackage[]> => {
    return await project.client.package.getComponents();
  },
);
