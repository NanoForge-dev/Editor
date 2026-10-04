import type { Disposable } from '@nanoforge-dev/editor-kernel';
import { CodeContract } from '@nanoforge-dev/editor-protocol';
import type { RpcRouter } from '@nanoforge-dev/editor-rpc';

import { Formatter } from '../../project/formatter';
import { collectTypeFiles } from '../../project/type-files';
import type { RequestContext } from '../../session/auth';
import type { CoreRpcDependencies } from '../core-rpc.type';

/** Implements the code contract. */
export const implementCodeRpc = (
  router: RpcRouter<RequestContext>,
  deps: CoreRpcDependencies,
): Disposable => {
  const { env, projects } = deps;
  const formatter = new Formatter(env.mode === 'OFFLINE' ? 'project' : 'static');
  return router.implement(CodeContract, {
    methods: {
      typeFiles: async ({ project, from, module }, { session }) => {
        const open = projects.get(session, project);
        const fromDir = await open.fs.jail.resolve(from.split('/').slice(0, -1).join('/'));
        return collectTypeFiles(open.root, fromDir, module);
      },
      format: async ({ project, path, text }, { session }) => {
        const open = projects.get(session, project);
        return formatter.format(open.root, await open.fs.jail.resolve(path), text);
      },
    },
  });
};
