import { fetchEnvLoaderAction } from '$lib/server/actions/project/loader/env.action';
import { fetchManifestLoaderAction } from '$lib/server/actions/project/loader/manifest.action';

export const actions = {
  env: fetchEnvLoaderAction,
  manifest: fetchManifestLoaderAction,
};
