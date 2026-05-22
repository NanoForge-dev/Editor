import type { NewComponentPackage } from '$lib/server/project/package/package.type';

import { useActionHandler } from '@utils-server/request-handler';

export class AddComponentBody {
  componentNames!: [string, ...string[]];
}

export const addComponentsProjectAction = useActionHandler(
  async ({ body, project, api }): Promise<NewComponentPackage[]> => {
    return await Promise.all(
      body.componentNames.map((componentName) =>
        project.client.package.installComponent(componentName, api),
      ),
    );
  },
  {
    body: AddComponentBody,
  },
);
