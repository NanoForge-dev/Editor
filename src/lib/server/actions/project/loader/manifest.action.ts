import { useActionHandler } from '@utils-server/request-handler';

export const fetchManifestLoaderAction = useActionHandler(async (handler) => {
  const { project } = handler;

  return project.client.loader.getManifest();
});
