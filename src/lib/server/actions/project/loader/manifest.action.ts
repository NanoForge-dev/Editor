import { useActionHandler } from '@utils-server/request-handler';

export const fetchManifestLoaderAction = useActionHandler(async ({ project }) => {
  return project.client.loader.getManifest();
});
