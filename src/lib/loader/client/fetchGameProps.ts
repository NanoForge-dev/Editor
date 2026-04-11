import { fetchGameFiles, loadGameFiles } from '$lib/loader/client/gameFiles';
import { fetchSave } from '$lib/loader/client/save';

import { fetchEnv } from './env';
import { fetchManifest } from './manifest';

export async function fetchGameProps(): Promise<Promise<unknown>[]> {
  const manifest = fetchManifest();
  const files = fetchGameFiles(await manifest);
  const save = fetchSave();
  const env = fetchEnv();
  const loadFiles = loadGameFiles(files);
  return [manifest, ...files, env, save, loadFiles];
}
