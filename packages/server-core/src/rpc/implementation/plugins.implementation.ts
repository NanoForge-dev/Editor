import type { Disposable } from '@nanoforge-dev/editor-kernel';
import { PluginsContract } from '@nanoforge-dev/editor-protocol';
import { RpcError, type RpcRouter } from '@nanoforge-dev/editor-rpc';

import type { RequestContext } from '../../session/auth';
import type { CoreRpcDependencies } from '../core-rpc.type';

/** Implements the plugins contract. */
export const implementPluginsRpc = (
  router: RpcRouter<RequestContext>,
  deps: CoreRpcDependencies,
): Disposable => {
  const { projects } = deps;
  return router.implement(PluginsContract, {
    methods: {
      list: async (input, { session }) => {
        const project = input?.project ? projects.get(session, input.project) : undefined;
        return (await deps.plugins.list(project)).map((plugin) => plugin.listing);
      },
      runProjectServers: async ({ project: id, names }, { session }) => {
        if (deps.env.mode !== 'OFFLINE')
          throw new RpcError(
            'FORBIDDEN',
            "A hosted editor never runs a project plugin's server entry",
          );
        const project = id ? projects.get(session, id) : undefined;
        if (project && names.length)
          projects.assertTrusted(project, "Running the project's plugins");
        const located = project ? await deps.plugins.list(project) : [];
        await deps.syncProjectServerPlugins?.(
          located.filter(
            (plugin) =>
              plugin.source === 'project' &&
              plugin.manifest?.entry.server &&
              names.includes(plugin.manifest.name),
          ),
        );
        return null;
      },
      suggestions: ({ project }, { session }) =>
        deps.plugins.suggestions(projects.get(session, project).root),
    },
    streams: {
      devChanges: (_params, _context, sink) =>
        deps.plugins.onDevChange((plugin) => {
          if (plugin.manifest) sink.emit({ name: plugin.manifest.name, listing: plugin.listing });
        }),
    },
  });
};
