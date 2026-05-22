import type { Loader } from '$lib/server/project/loader';

export type ActionLoaderManifest = ReturnType<Loader['getManifest']>;

export type ActionLoaderEnv = ReturnType<Loader['getEnv']>;
