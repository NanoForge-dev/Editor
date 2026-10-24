import { z } from 'zod';

/** Base editor → engine commands handled by every NanoForge app. */
export const RuntimeCommand = z.enum(['welcome', 'pause', 'resume', 'step', 'stop']);
export type RuntimeCommand = z.output<typeof RuntimeCommand>;

/** Run state reported by the engine (`state` bridge event). */
export const EngineRunState = z.enum(['running', 'paused', 'stopped']);
export type EngineRunState = z.output<typeof EngineRunState>;

export const BuildDiagnostic = z.object({
  /** Project-relative path when the file is inside the project. */
  path: z.string().optional(),
  line: z.number().int().optional(),
  column: z.number().int().optional(),
  message: z.string(),
  severity: z.enum(['error', 'warning']),
});
export type BuildDiagnostic = z.output<typeof BuildDiagnostic>;

export const BuildStatus = z.object({
  app: z.string(),
  state: z.enum(['idle', 'building', 'ok', 'error']),
  /** Content hash of the last successful output: changes when the game changes. */
  version: z.string().nullable(),
  diagnostics: z.array(BuildDiagnostic),
  /** End of the last build (ms since epoch). */
  finishedAt: z.number().nullable(),
  durationMs: z.number().nullable(),
});
export type BuildStatus = z.output<typeof BuildStatus>;

export const OutputFile = z.object({
  /** Path relative to the output directory, `/`-separated. */
  path: z.string(),
  size: z.number().int().nonnegative(),
  /** sha1 of the content: cache key of the file. */
  hash: z.string(),
});
export type OutputFile = z.output<typeof OutputFile>;

/** Build output of an app, served at `baseUrl`. */
export const OutputManifest = z.object({
  app: z.string(),
  version: z.string(),
  /** Absolute path on the server, ends with `/`. */
  baseUrl: z.string(),
  entry: z.string(),
  files: z.array(OutputFile),
});
export type OutputManifest = z.output<typeof OutputManifest>;

export const GameServerState = z.enum(['starting', 'running', 'paused', 'stopping', 'exited']);
export type GameServerState = z.output<typeof GameServerState>;

/** Environment overrides (`runtime.env` setting): `NANOFORGE_*` keys, as in `.env`. */
export const EnvOverrides = z.record(z.string(), z.string());
