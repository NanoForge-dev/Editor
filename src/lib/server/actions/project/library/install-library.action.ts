import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import type { LibraryPackage } from '$lib/server/project/library';

import { useActionHandler } from '@utils-server/request-handler';

export class InstallLibraryBody {
  @Expose()
  @IsString()
  @IsNotEmpty()
  libraryName!: string;
}

export const installLibraryProjectAction = useActionHandler(
  async ({ body, project }): Promise<LibraryPackage> => {
    return await project.client.library.installLibrary(body.libraryName);
  },
  {
    body: InstallLibraryBody,
  },
);
