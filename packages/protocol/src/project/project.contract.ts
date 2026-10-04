import { z } from 'zod';

import { defineContract } from '@nanoforge-dev/editor-rpc';

import { ProjectId, ProjectModel, ProjectRef, RecentProject } from './project.schema';

export const ProjectsContract = defineContract('projects', {
  methods: {
    open: {
      input: ProjectRef,
      output: z.object({ id: ProjectId, name: z.string() }),
    },
    recent: { input: z.null(), output: z.array(RecentProject) },
    forget: { input: z.object({ id: ProjectId }), output: z.null() },
    model: { input: z.object({ id: ProjectId }), output: ProjectModel },
    /**
     * Local editors: installs the project's dependencies with its package manager, found from
     * its lockfile. `manager` is null when no lockfile says which one to run; the output goes
     * to the project's console as a task.
     */
    install: {
      input: z.object({ id: ProjectId }),
      output: z.object({ manager: z.string().nullable(), ok: z.boolean() }),
    },
    /** Offline editors: runs `nf new` under the projects root, then opens the project. */
    create: {
      input: z.object({
        name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'lowercase letters, digits and dashes'),
        language: z.enum(['ts', 'js']).default('ts'),
        /** Multiplayer: adds a server app. */
        server: z.boolean().default(false),
        install: z.boolean().default(true),
        /** Installs the dependencies and runs the project's scripts. */
        packageManager: z.enum(['npm', 'pnpm', 'yarn', 'bun']).default('npm'),
      }),
      output: z.object({ id: ProjectId, name: z.string() }),
    },
    /** Online editors: projects of the signed-in account. */
    gateways: {
      input: z.null(),
      output: z.array(
        z.object({ gatewayId: z.string(), name: z.string(), description: z.string() }),
      ),
    },
  },
  streams: {
    /** The project model, re-sent whenever discovery re-runs. */
    model: { params: z.object({ id: ProjectId }), event: ProjectModel, coalesce: true },
  },
});
