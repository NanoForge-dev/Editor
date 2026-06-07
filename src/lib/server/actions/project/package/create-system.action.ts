import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import type { SystemPackage } from '$lib/server/project/package/package.type';

import { useActionHandler } from '@utils-server/request-handler';

export class CreateSystemBody {
  @Expose()
  @IsString()
  @IsNotEmpty()
  systemName!: string;
}

export const createSystemProjectAction = useActionHandler(
  async ({ body, project }): Promise<SystemPackage> => {
    return project.client.package.createSystem(body.systemName);
  },
  {
    body: CreateSystemBody,
  },
);
