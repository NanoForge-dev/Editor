import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import type { SystemManifest } from '$lib/server/project/package';

import { useActionHandler } from '@utils-server/request-handler';

export class GetSystemManifestBody {
  @Expose()
  @IsString({ each: true })
  @IsNotEmpty()
  systemPaths!: [string, ...string[]];
}

export const getSystemsManifestsAction = useActionHandler(
  async ({ body, project }): Promise<SystemManifest[]> => {
    return await Promise.all(
      body.systemPaths.map((path) => project.client.package.getSystemManifest(path)),
    );
  },
  {
    body: GetSystemManifestBody,
  },
);
