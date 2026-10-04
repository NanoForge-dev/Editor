import type { Disposable } from '@nanoforge-dev/editor-kernel';
import { SessionContract } from '@nanoforge-dev/editor-protocol';
import type { RpcRouter } from '@nanoforge-dev/editor-rpc';

import type { RequestContext } from '../../session/auth';
import type { CoreRpcDependencies } from '../core-rpc.type';

/** Implements the session contract. */
export const implementSessionRpc = (
  router: RpcRouter<RequestContext>,
  deps: CoreRpcDependencies,
): Disposable => {
  const { env } = deps;
  return router.implement(SessionContract, {
    methods: {
      info: (_input, { session }) => ({
        mode: env.mode,
        version: deps.version,
        user: session.user,
        loginUrl: env.mode === 'ONLINE' ? env.loginUrl : null,
        features: [
          ...(env.apiFeatures.includes('settings') ? (['settings'] as const) : []),
          ...(env.registryDir || env.registryUrl ? (['registry'] as const) : []),
        ],
      }),
      logout: (_input, context) => {
        context.responseCookies.push(...deps.sessions.logout(context.session));
        return null;
      },
    },
  });
};
