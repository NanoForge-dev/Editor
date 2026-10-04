import { type Disposable, DisposableStore } from '@nanoforge-dev/editor-kernel';
import type { RpcRouter } from '@nanoforge-dev/editor-rpc';

import type { RequestContext } from '../session/auth';
import type { CoreRpcDependencies } from './core-rpc.type';
import { implementCodeRpc } from './implementation/code.implementation';
import { implementFsRpc } from './implementation/fs.implementation';
import { implementGitRpc } from './implementation/git.implementation';
import { implementPluginsRpc } from './implementation/plugins.implementation';
import { implementProjectsRpc } from './implementation/projects.implementation';
import { implementRegistryRpc } from './implementation/registry.implementation';
import { implementRuntimeRpc } from './implementation/runtime.implementation';
import { implementSessionRpc } from './implementation/session.implementation';
import { implementSettingsRpc } from './implementation/settings.implementation';

export const implementCoreRpc = (
  router: RpcRouter<RequestContext>,
  deps: CoreRpcDependencies,
): Disposable => {
  const store = new DisposableStore();
  for (const implement of [
    implementSessionRpc,
    implementProjectsRpc,
    implementFsRpc,
    implementPluginsRpc,
    implementSettingsRpc,
    implementCodeRpc,
    implementRuntimeRpc,
    implementGitRpc,
    implementRegistryRpc,
  ])
    store.add(implement(router, deps));
  return store;
};
