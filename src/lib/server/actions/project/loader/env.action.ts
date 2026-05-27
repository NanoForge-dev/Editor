import { useActionHandler } from '@utils-server/request-handler';

export const fetchEnvLoaderAction = useActionHandler(async ({ project }) => {
  return project.client.loader.getEnv();
});
