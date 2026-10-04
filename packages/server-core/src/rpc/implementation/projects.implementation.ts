import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { type Disposable, observe } from '@nanoforge-dev/editor-kernel';
import { ProjectsContract } from '@nanoforge-dev/editor-protocol';
import { RpcError, type RpcRouter } from '@nanoforge-dev/editor-rpc';

import type { RequestContext } from '../../session/auth';
import type { CoreRpcDependencies } from '../core-rpc.type';
import { packageManagerOf } from '../package-manager-of';
import { requireUser } from '../require-user';

/** Implements the projects contract. */
export const implementProjectsRpc = (
  router: RpcRouter<RequestContext>,
  deps: CoreRpcDependencies,
): Disposable => {
  const { env, projects } = deps;
  return router.implement(ProjectsContract, {
    methods: {
      open: async (ref, { session }) => {
        const project = await projects.open(session, ref);
        return { id: project.id, name: project.name };
      },
      recent: (_input, context) => projects.recent(requireUser(context)),
      forget: async ({ id }, context) => {
        await projects.forget(requireUser(context), id);
        return null;
      },
      model: ({ id }, { session }) => projects.get(session, id).model.get(),
      install: async ({ id }, { session }) => {
        if (env.mode !== 'OFFLINE')
          throw new RpcError('FORBIDDEN', 'Dependencies are installed in local editors only');
        const { root } = projects.get(session, id);
        const manager = packageManagerOf(root);
        if (!manager) return { manager: null, ok: false };
        const result = await deps.cli.exec(manager, ['install'], { cwd: root }).done;
        return { manager, ok: result.exitCode === 0 };
      },
      create: async ({ name, language, server, install, packageManager }, { session }) => {
        if (env.mode !== 'OFFLINE')
          throw new RpcError('FORBIDDEN', 'Create projects from the NanoForge website');
        if (existsSync(join(env.fsRoot, name)))
          throw new RpcError('CONFLICT', `A folder named ${name} already exists`);
        const run = deps.cli.run(
          [
            'new',
            '--name',
            name,
            '--path',
            name,
            '--language',
            language,
            '--package-manager',
            packageManager,
            '--strict',
            server ? '--server' : '--no-server',
            '--no-git',
            '--no-docker',
            install ? '--no-skip-install' : '--skip-install',
          ],
          { cwd: env.fsRoot },
        );
        const result = await run.done;
        if (result.exitCode !== 0) {
          const output = (result.stderr || result.stdout).slice(-2000);
          const reason = output
            // eslint-disable-next-line no-control-regex
            .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .at(-1);
          throw new RpcError('INTERNAL', `nf new failed${reason ? `: ${reason}` : ''}`, {
            output,
          });
        }
        const project = await projects.open(session, { path: name });
        return { id: project.id, name: project.name };
      },
      gateways: async (_input, { session }) =>
        env.mode === 'ONLINE'
          ? (await deps.api.gatewayProjects(session)).map((project) => ({
              gatewayId: project.id,
              name: project.name,
              description: project.description,
            }))
          : [],
    },
    streams: {
      model: ({ id }, { session }, sink) =>
        observe(projects.get(session, id).model, (model) => sink.emit(model)),
    },
  });
};
