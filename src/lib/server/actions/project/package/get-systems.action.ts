import type { SystemPackage } from '$lib/server/project/package';

import { useActionHandler } from '@utils-server/request-handler';

export const getSystemsAction = useActionHandler(async ({ project }): Promise<SystemPackage[]> => {
  return await project.client.package.getSystems();
});
