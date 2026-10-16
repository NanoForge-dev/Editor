import { z } from 'zod';

import { defineContract } from '@nanoforge-dev/editor-rpc';

import { ProjectId, ProjectModel, ProjectRef, RecentProject } from './project.schema';

/** An opened project. `trusted`: its code may run; otherwise it is open in restricted mode. */
const OpenedProject = z.object({ id: ProjectId, name: z.string(), trusted: z.boolean() });

export const ProjectsContract = defineContract('projects', {
  methods: {
    open: {
      input: ProjectRef,
      output: OpenedProject,
    },
    recent: { input: z.null(), output: z.array(RecentProject) },
    forget: { input: z.object({ id: ProjectId }), output: z.null() },
    /**
     * Trusts a local project's folder: its code may run (config, plugins, builds, games…). The
     * project closes on the server: open it again.
     */
    trust: { input: z.object({ id: ProjectId }), output: z.null() },
    /** Whether an open project's code may run (see `trust`). */
    isTrusted: { input: z.object({ id: ProjectId }), output: z.boolean() },
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
      output: OpenedProject,
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
