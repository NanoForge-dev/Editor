import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : undefined));

const list = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

/**
 * What the NanoForge API offers the editor, beyond sign-in and projects. A feature that is not
 * listed in `API_FEATURES` is not called: the editor keeps to itself for it.
 *  - `settings`: account settings sync (docs/api/settings-sync.md). Without it, a hosted editor
 *    keeps account settings on its own disk.
 *  - `registry`: the registry of plugins and packages (docs/api/registry.md). Without it, the
 *    marketplace says it is not available (unless `REGISTRY_URL` or `REGISTRY_DIR` is set).
 */
export const API_FEATURES = ['settings', 'registry'] as const;
export type ApiFeature = (typeof API_FEATURES)[number];

/** Environment of the editor server, validated at startup. */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    /** OFFLINE: local projects on disk. ONLINE: hosted, projects synced with git gateways. */
    PUBLIC_MODE: z.enum(['OFFLINE', 'ONLINE']).default('OFFLINE'),
    HOST: optionalString,
    PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
    /** Projects must live under this directory (defaults to the working directory). */
    FS_ROOT: optionalString,
    /** Editor data: recent projects, installed plugins… */
    DATA_DIR: optionalString,
    API_URL: z.string().url().default('https://api.nanoforge.eu'),
    API_KEY: optionalString,
    /** The API features that are deployed, comma separated (`settings,registry`). None by default. */
    API_FEATURES: list,
    /** The registry of plugins and packages, when it is not the API's (`registry` feature). */
    REGISTRY_URL: optionalString,
    /** A folder standing in for the registry (`<dir>/@scope/name/<version>/`): tests, offline work. */
    REGISTRY_DIR: optionalString,
    /** NanoForge projects website, where ONLINE users sign in. */
    PUBLIC_PM_URL: z.string().url().default('https://projects.nanoforge.eu'),
    SESSION_SECRET: optionalString,
    NF_CLI_PATH: optionalString,
    GIT_PATH: optionalString,
    /** Extra origins allowed to call the server (dev proxies). */
    ALLOWED_ORIGINS: list,
    /** Directories of local plugins under development (their `dist/` is served). */
    DEV_PLUGINS: list,
    /** Directory of the plugins bundled with the editor build. */
    BUNDLED_PLUGINS_DIR: optionalString,
  })
  .superRefine((env, context) => {
    for (const feature of env.API_FEATURES) {
      if (!(API_FEATURES as readonly string[]).includes(feature)) {
        context.addIssue({
          code: 'custom',
          path: ['API_FEATURES'],
          message: `unknown feature "${feature}" (known: ${API_FEATURES.join(', ')})`,
        });
      }
    }
    if (env.PUBLIC_MODE === 'ONLINE' && !env.API_KEY) {
      context.addIssue({ code: 'custom', path: ['API_KEY'], message: 'required in ONLINE mode' });
    }
  });
