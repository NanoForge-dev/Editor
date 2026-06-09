import { Expose } from 'class-transformer';
import { IsNotEmpty, IsObject } from 'class-validator';

import type { Save } from '@utils/types';

import { useActionHandler } from '@utils-server/request-handler';

export class SetSaveBody {
  @Expose()
  @IsObject()
  @IsNotEmpty()
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
