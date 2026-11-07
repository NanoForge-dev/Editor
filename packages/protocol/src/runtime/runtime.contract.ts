import { z } from 'zod';

import { defineContract } from '@nanoforge-dev/editor-rpc';

import { ProjectId } from '../project/project.schema';
import { BuildStatus, EnvOverrides, GameServerState, OutputManifest } from './runtime.schema';

const Target = z.object({ project: ProjectId, app: z.string() });

export const RuntimeEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('build'), status: BuildStatus }),
  z.object({
    type: z.literal('log'),
    /** The app, or the command line of a `cli` run (`nf install …`). */
    app: z.string(),
    source: z.enum(['build', 'server', 'cli']),
    stream: z.enum(['stdout', 'stderr']),
    text: z.string(),
  }),
  z.object({
    type: z.literal('server'),
    app: z.string(),
    state: GameServerState,
    exitCode: z.number().nullable().optional(),
  }),
  /** An engine → editor event of the game server (`toEditor`). */
  z.object({
    type: z.literal('bridge'),
    app: z.string(),
    event: z.string(),
    args: z.array(z.unknown()),
  }),
]);
export type RuntimeEvent = z.output<typeof RuntimeEvent>;

export const RuntimeContract = defineContract('runtime', {
  methods: {
    /** Builds apps now (all runnable apps by default) and resolves with their status. */
    build: {
      input: z.object({ project: ProjectId, apps: z.array(z.string()).optional() }),
      output: z.array(BuildStatus),
    },
    status: {
      input: z.object({ project: ProjectId }),
      output: z.object({
        builds: z.array(BuildStatus),
        servers: z.array(z.object({ app: z.string(), state: GameServerState })),
      }),
    },
    manifest: { input: Target, output: OutputManifest },
    /** Environment of an app as the game sees it (prefixes stripped). */
    env: {
      input: Target.extend({ overrides: EnvOverrides.default({}) }),
      output: z.record(z.string(), z.string()),
    },
    startServer: {
      input: Target.extend({ overrides: EnvOverrides.default({}) }),
      output: z.null(),
    },
    /** Asks the game to stop, kills it after a timeout; resolves once it exited. */
    stopServer: { input: Target, output: z.null() },
    /** Sends an editor → engine event to the game server (`fromEditor`). */
    sendServer: {
      input: Target.extend({ event: z.string().min(1), args: z.array(z.unknown()).default([]) }),
      output: z.null(),
    },
  },
  streams: {
    /**
     * Builds, logs and game server events of a project. While subscribed, apps are rebuilt
     * when their sources change.
     */
    events: { params: z.object({ project: ProjectId }), event: RuntimeEvent },
  },
});
