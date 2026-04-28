import { localApi } from '$lib/components/Utils/api/api';
import { fetchGameFiles, loadGameFiles } from '$lib/loader/client/gameFiles';

export async function fetchGameProps(): Promise<Promise<unknown>[]> {
  const manifest = localApi.getGameLoadManifest('client');
  const files = fetchGameFiles(await manifest);
  const env = localApi.fetchEnv('client');
  const loadFiles = loadGameFiles(files);
  return [manifest, ...files, env, ...loadFiles];
}
