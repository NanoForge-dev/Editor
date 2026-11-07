import type { Disposable } from '@nanoforge-dev/editor-kernel';
import { SettingsContract } from '@nanoforge-dev/editor-protocol';
import type { RpcRouter } from '@nanoforge-dev/editor-rpc';

import type { RequestContext } from '../../session/auth';
import type { CoreRpcDependencies } from '../core-rpc.type';

/** Implements the settings contract. */
export const implementSettingsRpc = (
  router: RpcRouter<RequestContext>,
  deps: CoreRpcDependencies,
): Disposable => {
  const { projects } = deps;
  return router.implement(SettingsContract, {
    methods: {
      accountGet: (_input, { session }) => deps.accountSettings.get(session),
      accountPut: ({ baseRevision, values }, { session }) =>
        deps.accountSettings.put(session, baseRevision, values),
      projectLocalGet: ({ project }, { session }) => {
        projects.get(session, project);
        return deps.projectLocalSettings.get(session, project);
      },
      projectLocalPut: async ({ project, values }, { session }) => {
        projects.get(session, project);
        await deps.projectLocalSettings.put(session, project, values);
        return null;
      },
    },
    streams: {
      accountChanges: (_params, { session }, sink) =>
        deps.accountSettings.onDidChange(({ userId, revision }) => {
          if (userId === session.user?.id) sink.emit({ revision });
        }),
    },
  });
};
