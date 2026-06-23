import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import type { ComponentPackage, SystemPackage } from '$lib/server/project/package/package.type';

import { useActionHandler } from '@utils-server/request-handler';

export class InstallPackagesBody {
  @Expose()
  @IsString({ each: true })
  @IsNotEmpty()
  names!: [string, ...string[]];
}

export const installPackagesAction = useActionHandler(
  async ({ body, project }): Promise<(ComponentPackage | SystemPackage)[]> => {
    return await project.client.package.installPackages(body.names);
  },
  {
    body: InstallPackagesBody,
  },
);
