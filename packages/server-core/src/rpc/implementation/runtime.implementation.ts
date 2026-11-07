import { type Disposable, DisposableStore } from '@nanoforge-dev/editor-kernel';
import { RuntimeContract } from '@nanoforge-dev/editor-protocol';
import { RpcError, type RpcRouter } from '@nanoforge-dev/editor-rpc';

import type { OpenProject } from '../../project/project-registry';
import type { RequestContext } from '../../session/auth';
import type { CoreRpcDependencies } from '../core-rpc.type';

/** Implements the runtime contract. */
export const implementRuntimeRpc = (
  router: RpcRouter<RequestContext>,
  deps: CoreRpcDependencies,
): Disposable => {
  const { env, projects } = deps;
  const runtimeOf = (project: OpenProject) => {
    if (env.mode !== 'OFFLINE') {
      throw new RpcError('FORBIDDEN', 'Games can only be run from a local editor');
    }
    return deps.runtime.get(project);
  };
  /** The runtime of a project whose code may run: building and playing run it. */
  const runnable = (project: OpenProject, what: string) => {
    projects.assertTrusted(project, what);
    return runtimeOf(project);
  };
  return router.implement(RuntimeContract, {
    methods: {
      build: ({ project, apps }, { session }) =>
        runnable(projects.get(session, project), 'Building').builds.build(apps),
      status: ({ project }, { session }) => {
        const runtime = runtimeOf(projects.get(session, project));
        return {
          builds: runtime.builds.apps.map((app) => runtime.builds.status(app.id)),
          servers: runtime.servers(),
        };
      },
      manifest: ({ project, app }, { session }) =>
        runtimeOf(projects.get(session, project)).manifest(app),
      env: ({ project, app, overrides }, { session }) =>
        runtimeOf(projects.get(session, project)).env(app, overrides),
      startServer: async ({ project, app, overrides }, { session }) => {
        await runnable(projects.get(session, project), 'Playing').startServer(app, overrides);
        return null;
      },
      stopServer: async ({ project, app }, { session }) => {
        await runtimeOf(projects.get(session, project)).stopServer(app);
        return null;
      },
      sendServer: ({ project, app, event, args }, { session }) => {
        runtimeOf(projects.get(session, project)).sendServer(app, event, args);
        return null;
      },
    },
    streams: {
      events: ({ project }, { session }, sink) => {
        const open = projects.get(session, project);
        const runtime = runtimeOf(open);
        const subscription = new DisposableStore();
        if (open.trusted) subscription.add(runtime.builds.watch());
        subscription.add(runtime.onEvent((event) => sink.emit(event)));
        return subscription;
      },
    },
  });
};
