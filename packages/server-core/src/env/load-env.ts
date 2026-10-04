import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

import type { EditorEnv } from './editor-env.type';
import { EnvError } from './env.exception';
import { type ApiFeature, EnvSchema } from './env.schema';

export const loadEnv = (
  source: Record<string, string | undefined> = process.env,
  cwd = process.cwd(),
): EditorEnv => {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  const env = result.data;
  const absolute = (path: string) => (isAbsolute(path) ? path : resolve(cwd, path));
  return {
    production: env.NODE_ENV === 'production',
    mode: env.PUBLIC_MODE,
    host: env.HOST ?? (env.PUBLIC_MODE === 'OFFLINE' ? '127.0.0.1' : '0.0.0.0'),
    port: env.PORT,
    fsRoot: absolute(env.FS_ROOT ?? '.'),
    dataDir: absolute(env.DATA_DIR ?? join(homedir(), '.nanoforge', 'editor')),
    apiUrl: env.API_URL,
    apiKey: env.API_KEY,
    apiFeatures: env.API_FEATURES as ApiFeature[],
    registryUrl:
      env.REGISTRY_URL ?? (env.API_FEATURES.includes('registry') ? env.API_URL : undefined),
    registryDir: env.REGISTRY_DIR && absolute(env.REGISTRY_DIR),
    loginUrl: env.PUBLIC_PM_URL,
    sessionSecret: env.SESSION_SECRET ?? randomBytes(32).toString('hex'),
    cliPath: env.NF_CLI_PATH,
    gitPath: env.GIT_PATH ?? 'git',
    allowedOrigins: env.ALLOWED_ORIGINS,
    devPlugins: env.DEV_PLUGINS.map(absolute),
    bundledPluginsDir: env.BUNDLED_PLUGINS_DIR && absolute(env.BUNDLED_PLUGINS_DIR),
  };
};
