import type { AssetPackage } from '$lib/server/project/package';

import { useActionHandler } from '@utils-server/request-handler';

export const getAssetsAction = useActionHandler(async ({ project }): Promise<AssetPackage[]> => {
  return await project.client.package.getAssets();
});
