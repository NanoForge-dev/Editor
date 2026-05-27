import { buildProjectAction } from '$lib/server/actions/project/loader/build.action';
import { fetchEnvLoaderAction } from '$lib/server/actions/project/loader/env.action';
import { fetchManifestLoaderAction } from '$lib/server/actions/project/loader/manifest.action';

export const actions = {
  build: buildProjectAction,
  env: fetchEnvLoaderAction,
  manifest: fetchManifestLoaderAction,
};
