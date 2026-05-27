import { useActionHandler } from '@utils-server/request-handler';

export const getSaveAction = useActionHandler(async ({ project }) => {
  return project.client.save.getSave();
});
