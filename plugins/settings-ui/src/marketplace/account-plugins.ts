import {
  type Disposable,
  type PluginHost,
  RegistryContract,
  type RpcClient,
  SessionContract,
  type SettingsService,
} from '@nanoforge-dev/editor-sdk';
import type { NotificationService } from '@nanoforge-dev/editor-sdk/ui';

import {
  ACCOUNT_PLUGINS,
  type AccountPlugins,
  missingAccountPlugins,
  withoutAccountPlugins,
} from './marketplace';

export interface AccountPluginsOptions {
  readonly rpc: RpcClient;
  readonly settings: SettingsService;
  readonly host: PluginHost;
  readonly notifications: NotificationService;
  /** Wait before the first look, so the account settings and the plugin list are there. */
  readonly delay?: number;
}

/**
 * Offers to install the plugins of the account that this editor lacks (installed "for me" on
 * another machine). Local editors only: a hosted editor does not install plugins.
 */
export const followAccountPlugins = (options: AccountPluginsOptions): Disposable => {
  const { rpc, settings, host, notifications } = options;
  const registry = rpc.api(RegistryContract);
  /** Names already offered in this session: one notification each, not one per sync. */
  const offered = new Set<string>();
  let disposed = false;

  const list = () => (settings.get(ACCOUNT_PLUGINS) ?? {}) as AccountPlugins;
  const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const install = async (names: readonly string[]) => {
    const failed: string[] = [];
    for (const name of names) {
      try {
        await registry.installPlugin({ name, scope: 'user' });
      } catch (error) {
        failed.push(`${name}: ${message(error)}`);
      }
    }
    if (failed.length) {
      notifications.notify('error', 'Some plugins could not be installed', {
        detail: failed.join('. '),
      });
    }
    if (failed.length < names.length) {
      notifications.notify('info', 'Plugins installed: reload the editor to finish', {
        actions: [{ title: 'Reload now', run: () => location.reload() }],
        timeout: 0,
      });
    }
  };

  const check = () => {
    if (disposed) return;
    const known = host.plugins.get().map((plugin) => ({
      name: plugin.name,
      version: plugin.descriptor.manifest.version,
      source: plugin.descriptor.source,
    }));
    const missing = missingAccountPlugins(list(), known).filter((name) => !offered.has(name));
    if (!missing.length) return;
    for (const name of missing) offered.add(name);
    const count = missing.length > 1 ? `${missing.length} plugins` : 'A plugin';
    notifications.notify(
      'info',
      `${count} of your account ${missing.length > 1 ? 'are' : 'is'} not installed here`,
      {
        detail: missing.join(', '),
        actions: [
          { title: 'Install', run: () => install(missing) },
          {
            title: 'Remove from my account',
            run: () =>
              settings.set(ACCOUNT_PLUGINS, withoutAccountPlugins(list(), missing), 'account'),
          },
        ],
        timeout: 0,
      },
    );
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  let subscription: Disposable | undefined;
  void rpc
    .api(SessionContract)
    .info(null)
    .then((session) => {
      if (disposed || session.mode !== 'OFFLINE') return;
      timer = setTimeout(check, options.delay ?? 3000);
      subscription = settings.onDidChange((event) => {
        if (event.keys.has(ACCOUNT_PLUGINS)) check();
      });
    })
    .catch(() => undefined);

  return {
    dispose: () => {
      disposed = true;
      clearTimeout(timer);
      subscription?.dispose();
    },
  };
};
