import { SvelteMap } from 'svelte/reactivity';

import {
  type PluginScope,
  RegistryContract,
  type RegistryItem,
  type RegistrySummary,
  type RpcClient,
  type SettingsService,
} from '@nanoforge-dev/editor-sdk';

import {
  ACCOUNT_PLUGINS,
  type AccountPlugins,
  type InstalledCopy,
  type KnownPlugin,
  type PendingChange,
  installedCopy,
  scopeOf,
  withAccountPlugin,
  withoutAccountPlugins,
} from '../../../marketplace/marketplace';

export const registryApi = (rpc: RpcClient) => rpc.api(RegistryContract);
export type RegistryApi = ReturnType<typeof registryApi>;
export type PluginDetails = RegistryItem & { compatible?: string | undefined };

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const codeOf = (error: unknown) => (error as { code?: string }).code;

/**
 * What the Plugins page keeps while its tabs come and go: the marketplace search, the selected
 * plugin, and what the page installed or removed (the editor follows after a reload).
 */
export class PluginsPageState {
  query = $state('');
  results = $state<RegistrySummary[]>([]);
  total = $state(0);
  searching = $state(false);
  /** Why the marketplace can't be shown, when it can't. */
  unavailable = $state<string>();
  selected = $state<string>();
  details = $state<PluginDetails>();
  /** The plugin being installed, updated or removed. */
  busy = $state<string>();
  failure = $state<string>();
  /** What this page changed on disk: the editor follows after a reload. */
  readonly pending = new SvelteMap<string, PendingChange>();
  /** The newest version this editor can run, per installed plugin the registry knows. */
  readonly newest = new SvelteMap<string, string>();
  private _generation = 0;
  private _lookedUp = false;

  constructor(
    private readonly _registry: RegistryApi,
    readonly project: string | undefined,
    private readonly _settings: SettingsService,
    /** The plugins the host knows. */
    private readonly _known: () => readonly KnownPlugin[],
  ) {}

  copyOf(name: string): InstalledCopy | undefined {
    return installedCopy(name, this._known(), this.pending);
  }

  async search(text: string): Promise<void> {
    const mine = ++this._generation;
    this.searching = true;
    try {
      const found = await this._registry.search({ type: 'plugin', q: text });
      if (mine !== this._generation) return;
      this.results = found.items;
      this.total = found.total;
      this.unavailable = undefined;
      if (!found.items.some((item) => item.name === this.selected))
        this.selected = found.items[0]?.name;
    } catch (error) {
      if (mine !== this._generation) return;
      this.results = [];
      this.total = 0;
      this.unavailable =
        codeOf(error) === 'UNAVAILABLE'
          ? 'The plugin registry cannot be reached right now. Installed plugins keep working.'
          : message(error);
    } finally {
      if (mine === this._generation) this.searching = false;
    }
  }

  /** Reads the details of a plugin; the returned function drops a late answer. */
  loadDetails(name: string): () => void {
    let stale = false;
    this._registry.details({ name }).then(
      (item) => {
        if (stale) return;
        this.details = item;
        if (item.compatible) this.newest.set(name, item.compatible);
      },
      () => undefined,
    );
    return () => {
      stale = true;
    };
  }

  /** Asks the registry, once, for the newest version of each installed plugin. */
  lookUpNewest(known: readonly KnownPlugin[]): void {
    if (this._lookedUp) return;
    this._lookedUp = true;
    for (const plugin of known) {
      if (!scopeOf(plugin.source)) continue;
      this._registry.details({ name: plugin.name }).then(
        (item) => item.compatible && this.newest.set(plugin.name, item.compatible),
        () => undefined,
      );
    }
  }

  install(name: string, scope: PluginScope): Promise<void> {
    return this._run(name, async () => {
      const { version } = await this._registry.installPlugin(this._target(name, scope));
      if (scope === 'user') this._remember(withAccountPlugin(this._accountList(), name, version));
      return { version, scope };
    });
  }

  uninstall(name: string, scope: PluginScope): Promise<void> {
    return this._run(name, async () => {
      await this._registry.uninstallPlugin(this._target(name, scope));
      if (scope === 'user') this._remember(withoutAccountPlugins(this._accountList(), [name]));
      return 'removed';
    });
  }

  private async _run(name: string, action: () => Promise<PendingChange>): Promise<void> {
    this.busy = name;
    this.failure = undefined;
    try {
      this.pending.set(name, await action());
    } catch (error) {
      this.failure =
        codeOf(error) === 'FORBIDDEN'
          ? 'Plugins can only be installed in a local editor.'
          : `${name}: ${message(error)}`;
    } finally {
      this.busy = undefined;
    }
  }

  private _accountList(): AccountPlugins {
    return (this._settings.get(ACCOUNT_PLUGINS) ?? {}) as AccountPlugins;
  }

  private _remember(list: AccountPlugins): void {
    if (this._settings.hasStore('account'))
      void this._settings.set(ACCOUNT_PLUGINS, list, 'account');
  }

  private _target(name: string, scope: PluginScope) {
    return { name, scope, ...(scope === 'project' && this.project && { project: this.project }) };
  }
}
