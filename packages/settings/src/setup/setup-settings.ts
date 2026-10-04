import {
  type Container,
  CoreServices,
  type Disposable,
  DisposableStore,
  observe,
} from '@nanoforge-dev/editor-kernel';
import type { ClientProject } from '@nanoforge-dev/editor-project';
import type { RpcClient } from '@nanoforge-dev/editor-rpc';

import { AccountSyncStore } from '../account-sync/account-sync-store';
import { rpcAccountRemote } from '../account-sync/rpc-account-remote';
import { CoreSettings } from '../definition/core-settings';
import { IndexedDbKeyValueStore } from '../key-value/indexed-db.key-value-store';
import type { KeyValueStore } from '../key-value/key-value-store.type';
import { MemoryKeyValueStore } from '../key-value/memory.key-value-store';
import { SettingsRegistry, SettingsRegistryToken } from '../registry/settings-registry';
import { SettingsService, SettingsServiceToken } from '../service/settings-service';
import { JsonFileScopeStore } from '../store/json-file.scope-store';
import { KeyValueScopeStore } from '../store/key-value.scope-store';
import {
  PROJECT_LOCAL_SETTINGS_FILE,
  PROJECT_SETTINGS_FILE,
  projectFileAdapter,
} from '../store/project-file-adapter';
import { RemoteProjectLocalStore } from '../store/remote-project-local.scope-store';

export interface SettingsSetupOptions {
  services: Container;
  rpc: RpcClient;
  mode: 'OFFLINE' | 'ONLINE';
  /** Identifies whose account data the browser caches (a user id). */
  userId: string;
  kv?: KeyValueStore;
}

export interface SettingsSetup extends Disposable {
  readonly settings: SettingsService;
  readonly registry: SettingsRegistry;
  readonly account: AccountSyncStore;
  /** Attaches the project and projectLocal scopes of a project (detached on dispose). */
  attachProject(project: ClientProject): Promise<Disposable>;
}

/**
 * Creates the settings services of an editor window: machine scope in IndexedDB, account scope
 * synced through the editor server, project scopes attached per project.
 */
export const setupSettings = async (options: SettingsSetupOptions): Promise<SettingsSetup> => {
  const { services, rpc } = options;
  const store = new DisposableStore();
  const logger = services.get(CoreServices.Logger).getLogger('settings');
  const kv =
    options.kv ??
    (IndexedDbKeyValueStore.isSupported()
      ? new IndexedDbKeyValueStore()
      : new MemoryKeyValueStore());

  const registry = new SettingsRegistry();
  store.add(registry.register(...Object.values(CoreSettings)));
  const settings = store.add(new SettingsService(registry, logger));
  services.provide(SettingsRegistryToken, registry);
  services.provide(SettingsServiceToken, settings);

  store.add(await settings.setStore('machine', new KeyValueScopeStore(kv, 'scope:machine')));

  const remote = rpcAccountRemote(rpc);
  const account = store.add(
    new AccountSyncStore(remote, kv, `scope:account:${options.userId}`, {
      isSynced: (key) => registry.get(key)?.sync ?? true,
    }),
  );
  store.add(await settings.setStore('account', account));
  const unwatch = remote.watch(() => void account.sync());
  store.add({ dispose: unwatch });

  const i18n = services.get(CoreServices.Localization);
  store.add(observe(settings.observe(CoreSettings.locale), (locale) => i18n.setLocale(locale)));

  const attachProject = async (project: ClientProject): Promise<Disposable> => {
    const attached = new DisposableStore();
    const projectStore = new JsonFileScopeStore(
      projectFileAdapter(project.fs, PROJECT_SETTINGS_FILE),
    );
    const localStore =
      options.mode === 'ONLINE'
        ? new RemoteProjectLocalStore(rpc, project.id)
        : new JsonFileScopeStore(
            projectFileAdapter(project.fs, PROJECT_LOCAL_SETTINGS_FILE, { gitignored: true }),
          );
    attached.add(projectStore);
    attached.add(localStore);
    attached.add(await settings.setStore('project', projectStore));
    attached.add(await settings.setStore('projectLocal', localStore));
    return attached;
  };

  return { settings, registry, account, attachProject, dispose: () => store.dispose() };
};
