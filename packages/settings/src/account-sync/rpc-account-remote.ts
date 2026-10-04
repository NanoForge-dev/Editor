import { SettingsContract } from '@nanoforge-dev/editor-protocol';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';

import type { AccountRemote } from './account-sync.type';

/**
 * Account settings through the editor server (which uses the NanoForge API online, or the local
 * data dir offline). Saves from other tabs/devices are announced so the store pulls them.
 */
export const rpcAccountRemote = (
  rpc: RpcClient,
): AccountRemote & { watch(onChange: () => void): () => void } => {
  const api = rpc.api(SettingsContract);
  return {
    get: () => api.accountGet(null),
    put: (baseRevision, values) => api.accountPut({ baseRevision, values }),
    onDidReconnect: rpc.onDidReconnect,
    watch: (onChange) => {
      const subscription = rpc.subscribe(SettingsContract, 'accountChanges', null, () =>
        onChange(),
      );
      return () => subscription.dispose();
    },
  };
};
