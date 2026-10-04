import type { Disposable } from '@nanoforge-dev/editor-kernel';
import { FsContract } from '@nanoforge-dev/editor-protocol';
import { RpcError, type RpcRouter } from '@nanoforge-dev/editor-rpc';

import { revealInFileManager } from '../../fs/reveal';
import type { RequestContext } from '../../session/auth';
import type { CoreRpcDependencies } from '../core-rpc.type';

/** Implements the file system contract. */
export const implementFsRpc = (
  router: RpcRouter<RequestContext>,
  deps: CoreRpcDependencies,
): Disposable => {
  const { env, projects } = deps;
  return router.implement(FsContract, {
    methods: {
      stat: ({ project, path }, { session }) => projects.get(session, project).fs.stat(path),
      list: ({ project, path, recursive }, { session }) =>
        projects.get(session, project).fs.list(path, recursive),
      read: ({ project, path }, { session }) => projects.get(session, project).fs.read(path),
      write: ({ project, path, content, expectedHash, createParents }, { session }) =>
        projects.get(session, project).fs.write(path, content, {
          ...(expectedHash !== undefined && { expectedHash }),
          createParents,
        }),
      mkdir: ({ project, path }, { session }) => projects.get(session, project).fs.mkdir(path),
      rename: ({ project, from, to, overwrite }, { session }) =>
        projects.get(session, project).fs.rename(from, to, overwrite),
      copy: ({ project, from, to, overwrite }, { session }) =>
        projects.get(session, project).fs.copy(from, to, overwrite),
      delete: ({ project, path }, { session }) => projects.get(session, project).fs.delete(path),
      restore: ({ project, trashPath, path }, { session }) =>
        projects.get(session, project).fs.restore(trashPath, path),
      reveal: async ({ project, path }, { session }) => {
        if (env.mode !== 'OFFLINE') {
          throw new RpcError('FORBIDDEN', 'Revealing files needs a local editor');
        }
        await revealInFileManager(await projects.get(session, project).fs.jail.resolve(path));
        return null;
      },
    },
    streams: {
      changes: ({ project }, { session }, sink) =>
        projects.get(session, project).watcher.onDidChange((changes) => sink.emit({ changes })),
    },
  });
};
