import { useActionHandler } from '@utils-server/request-handler';

export const fetchEnvLoaderAction = useActionHandler(async (handler) => {
  const { project } = handler;

  return project.client.loader.getEnv();
});
