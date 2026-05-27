import { type Save } from '@utils/types';

import { useActionHandler } from '@utils-server/request-handler';

export class SetSaveBody {
  save!: Save;
}

export const setSaveAction = useActionHandler(
  async ({ project, body }) => {
    return project.client.save.updateSave(body.save);
  },
  {
    body: SetSaveBody,
  },
);
