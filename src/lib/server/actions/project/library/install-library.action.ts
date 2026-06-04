import type { LibraryPackage } from '$lib/server/project/library';

import { useActionHandler } from '@utils-server/request-handler';

export class InstallLibraryBody {
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
