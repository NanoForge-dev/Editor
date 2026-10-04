import type { Disposable } from '@nanoforge-dev/editor-kernel';
import { GitContract } from '@nanoforge-dev/editor-protocol';
import { RpcError, type RpcRouter } from '@nanoforge-dev/editor-rpc';

import type { RequestContext } from '../../session/auth';
import type { CoreRpcDependencies } from '../core-rpc.type';

/** Implements the git contract. */
export const implementGitRpc = (
  router: RpcRouter<RequestContext>,
  deps: CoreRpcDependencies,
): Disposable => {
  const { env, projects } = deps;
  const repo = (session: RequestContext['session'], project: string) => {
    if (env.mode !== 'OFFLINE') throw new RpcError('FORBIDDEN', 'Git is for local editors');
    return projects.get(session, project).root;
  };
  const { git } = deps;
  const nothing =
    <I extends { project: string }>(run: (root: string, input: I) => Promise<unknown>) =>
    async (input: I, { session }: RequestContext) => {
      await run(repo(session, input.project), input);
      return null;
    };
  return router.implement(GitContract, {
    methods: {
      status: ({ project }, { session }) => git.projectStatus(repo(session, project)),
      init: nothing((root) => git.init(root)),
      stage: nothing((root, { paths }) => git.stage(root, paths)),
      unstage: nothing((root, { paths }) => git.unstage(root, paths)),
      discard: nothing((root, { paths }) => git.discard(root, paths)),
      commit: nothing((root, { message, all, paths, amend }) =>
        git.commit(root, message, { all, amend, ...(paths && { paths }) }),
      ),
      fetch: nothing((root) => git.fetch(root)),
      pull: ({ project }, { session }) => git.mergePull(repo(session, project)),
      push: nothing((root) => git.push(root)),
      branches: ({ project }, { session }) => git.branches(repo(session, project)),
      switchBranch: nothing((root, { name }) => git.switchBranch(root, name)),
      createBranch: nothing((root, { name, from }) => git.createBranch(root, name, from)),
      deleteBranch: nothing((root, { name, force }) => git.deleteBranch(root, name, force)),
      log: ({ project, limit, skip, branch }, { session }) =>
        git.log(repo(session, project), limit, skip, branch),
      outgoing: ({ project }, { session }) => git.outgoing(repo(session, project)),
      commitFiles: ({ project, hash }, { session }) =>
        git.commitFiles(repo(session, project), hash),
      show: ({ project, path, revision }, { session }) =>
        git.show(repo(session, project), path, revision),
      stashes: ({ project }, { session }) => git.stashes(repo(session, project)),
      stash: nothing((root, { message }) => git.stash(root, message)),
      applyStash: nothing((root, { index, pop }) => git.applyStash(root, index, pop)),
      dropStash: nothing((root, { index }) => git.dropStash(root, index)),
    },
  });
};
