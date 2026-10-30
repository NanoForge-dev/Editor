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

/** `localhost`, `127.x.x.x` or `::1`. */
const isLoopback = (host: string) =>
  host === 'localhost' || /^127(\.\d{1,3}){3}$/.test(host) || ['::1', '[::1]'].includes(host);

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
    /** `production`, `development` (more logs, dev tooling) or `test`. */
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    /** OFFLINE: local projects on disk. ONLINE: hosted, projects synced with git gateways. */
    PUBLIC_MODE: z.enum(['OFFLINE', 'ONLINE']).default('OFFLINE'),
    /**
     * Address the server listens on. In OFFLINE mode it must be a loopback address (no sign-in,
     * project code runs), unless `ALLOW_REMOTE_OFFLINE` is set.
     */
    HOST: optionalString,
    /** Port the server listens on (0: any free port). */
    PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
    /** Projects must live under this directory (defaults to the working directory). */
    FS_ROOT: optionalString,
    /** Editor data: recent projects, installed plugins… (defaults to `~/.nanoforge/editor`). */
    DATA_DIR: optionalString,
    /** The NanoForge API. */
    API_URL: z.string().url().default('https://api.nanoforge.eu'),
    /** The editor's key for the NanoForge API: required in ONLINE mode. */
    API_KEY: optionalString,
    /** The API features that are deployed, comma separated (`settings,registry`). None by default. */
    API_FEATURES: list,
    /** The registry of plugins and packages, when it is not the API's (`registry` feature). */
    REGISTRY_URL: optionalString,
    /** A folder standing in for the registry (`<dir>/@scope/name/<version>/`): tests, offline work. */
    REGISTRY_DIR: optionalString,
    /** NanoForge projects website, where ONLINE users sign in. */
    PUBLIC_PM_URL: z.string().url().default('https://projects.nanoforge.eu'),
    /** Signs the session cookies. Empty: a random one at each start (sessions end on restart). */
    SESSION_SECRET: optionalString,
    /** The NanoForge CLI, when `nf` is not in the PATH (a project's own CLI is tried first). */
    NF_CLI_PATH: optionalString,
    /** Git, when `git` is not in the PATH. */
    GIT_PATH: optionalString,
    /** Extra origins allowed to call the server (dev proxies). */
    ALLOWED_ORIGINS: list,
    /**
     * Host names the server answers to besides localhost (DNS rebinding guard), comma separated.
     * A local editor reached by another name needs it; a hosted one checks it when it is set.
     */
    ALLOWED_HOSTS: list,
    /** Directories of local plugins under development (their `dist/` is served). */
    DEV_PLUGINS: list,
    /** Directory of the plugins bundled with the editor build. */
    BUNDLED_PLUGINS_DIR: optionalString,
    /** Files of the tutorial's project (_Help › Tutorial_), when not next to the editor build. */
    TUTORIAL_DIR: optionalString,
    /**
     * A local editor answers only to a browser that opened its link with this token once (other
     * users of a shared machine can reach its loopback port). `random`: a new token at each
     * start, printed with the link. Unset: no token (a machine of your own).
     */
    EDITOR_TOKEN: optionalString,
    /**
     * Lets a local (OFFLINE) editor listen on a non-loopback `HOST`. It has no sign-in and runs
     * project code: only set it behind something that restricts who can connect.
     */
    ALLOW_REMOTE_OFFLINE: z
      .string()
      .optional()
      .transform((value) => value === '1' || value === 'true'),
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
    if (
      env.PUBLIC_MODE === 'OFFLINE' &&
      env.HOST &&
      !isLoopback(env.HOST) &&
      !env.ALLOW_REMOTE_OFFLINE
    ) {
      context.addIssue({
        code: 'custom',
        path: ['HOST'],
        message: `a local (OFFLINE) editor has no sign-in and runs project code: it only listens on a loopback address, not "${env.HOST}". Set PUBLIC_MODE=ONLINE for a hosted editor, or ALLOW_REMOTE_OFFLINE=1 behind something that restricts who can connect`,
      });
    }
    if (env.PUBLIC_MODE === 'ONLINE' && !env.API_KEY) {
      context.addIssue({ code: 'custom', path: ['API_KEY'], message: 'required in ONLINE mode' });
    }
  });
