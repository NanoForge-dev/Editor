import type { Disposable } from '@nanoforge-dev/editor-kernel';
import { PluginsContract } from '@nanoforge-dev/editor-protocol';
import type { RpcRouter } from '@nanoforge-dev/editor-rpc';

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
        const located = await deps.plugins.list(project);
        if (deps.env.mode === 'OFFLINE') {
          for (const plugin of located) {
            if (plugin.source === 'project' && plugin.manifest?.entry.server)
              await deps.activateServerPlugin?.(plugin);
          }
        }
        return located.map((plugin) => plugin.listing);
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
