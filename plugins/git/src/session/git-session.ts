import { GitContract, type RpcClient } from '@nanoforge-dev/editor-sdk';

import type { GitActions } from '../actions/create-actions';
import type { GitStore } from '../store/git-store';

export const gitApi = (rpc: RpcClient) => rpc.api(GitContract);
export type GitRpc = ReturnType<typeof gitApi>;

/** What the plugin shares with its panel. */
export interface GitSession {
  readonly store: GitStore;
  readonly api: GitRpc;
  readonly actions: GitActions;
}

let session: GitSession | undefined;

export const setSession = (value: GitSession | undefined): void => {
  session = value;
};

export const getSession = (): GitSession => {
  if (!session) throw new Error('The git plugin is not active');
  return session;
};
