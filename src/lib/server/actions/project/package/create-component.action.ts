import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import type { ComponentPackage } from '$lib/server/project/package/package.type';

import { useActionHandler } from '@utils-server/request-handler';

export class CreateComponentBody {
  @Expose()
  @IsString()
  @IsNotEmpty()
  componentName!: string;
}

export const createComponentProjectAction = useActionHandler(
  async ({ body, project }): Promise<ComponentPackage> => {
    return project.client.package.createComponent(body.componentName);
  },
  {
    body: CreateComponentBody,
  },
);
