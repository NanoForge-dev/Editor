import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  type Disposable,
  DisposableStore,
  type Logger,
  type LoggerService,
  type PluginManifest,
} from '@nanoforge-dev/editor-kernel';
import type { Contract, Implementation, RpcRouter } from '@nanoforge-dev/editor-rpc';

import type { RequestContext } from '../session/auth';
import type { LocatedPlugin } from './plugin-sources';

/** Server-side services a plugin server entry may use. */
export interface ServerPluginServices {
  readonly [name: string]: unknown;
}

/** What a plugin's `entry.server` module receives in `activate`. */
export interface ServerPluginContext<S extends ServerPluginServices = ServerPluginServices> {
  readonly name: string;
  readonly manifest: PluginManifest;
  readonly subscriptions: DisposableStore;
  readonly logger: Logger;
  readonly services: S;
  /** RPC namespace of the plugin: contracts must use it (`plugin.<name>`). */
  readonly namespace: string;
  implement<C extends Contract>(
    contract: C,
    implementation: Implementation<C, RequestContext>,
  ): Disposable;
}

export interface ServerPluginModule {
  activate?(context: ServerPluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

export const pluginNamespace = (name: string) => `plugin.${name}`;

interface ActiveServerPlugin {
  readonly plugin: LocatedPlugin;
  readonly module: ServerPluginModule;
  readonly store: DisposableStore;
}

/** Runs `entry.server` of enabled plugins inside the editor server (trusted plugins). */
export class ServerPluginHost implements Disposable {
  private readonly _active = new Map<string, ActiveServerPlugin>();
  /** Activations in progress: a second request for the same plugin waits for the first one. */
  private readonly _activating = new Map<string, Promise<void>>();
  /** Plugins a project's copy of the same name replaced, run again when that copy stops. */
  private readonly _shadowed = new Map<string, LocatedPlugin>();

  constructor(
    private readonly _router: RpcRouter<RequestContext>,
    private readonly _services: ServerPluginServices,
    private readonly _logs: LoggerService,
  ) {}

  get active(): string[] {
    return [...this._active.keys()];
  }

  activate(plugin: LocatedPlugin): Promise<void> {
    const name = plugin.manifest?.name;
    if (
      !name ||
      !plugin.manifest?.entry.server ||
      this._active.get(name)?.plugin.dir === plugin.dir
    )
      return Promise.resolve();
    let activating = this._activating.get(name);
    if (!activating) {
      activating = this._replace(plugin).finally(() => this._activating.delete(name));
      this._activating.set(name, activating);
    }
    return activating;
  }

  /**
   * Runs the server entries of exactly these project plugins (those the editor enabled for the
   * open project) and stops every other project plugin's, those of a previous project included.
   * A plugin a project copy had replaced runs again.
   */
  async syncProject(plugins: readonly LocatedPlugin[]): Promise<void> {
    const wanted = new Set(plugins.map((plugin) => plugin.dir));
    for (const [name, active] of [...this._active]) {
      if (active.plugin.source === 'project' && !wanted.has(active.plugin.dir))
        await this.deactivate(name);
    }
    for (const plugin of plugins) await this.activate(plugin);
  }

  /**
   * Stops a plugin's server entry; with `dir`, only when the running copy is that folder's. A
   * plugin a stopped project copy had replaced runs again.
   */
  async deactivate(name: string, dir?: string): Promise<void> {
    if (dir && this._shadowed.get(name)?.dir === dir) this._shadowed.delete(name);
    const stopped = await this._stop(name, dir);
    const shadowed = stopped?.source === 'project' ? this._shadowed.get(name) : undefined;
    this._shadowed.delete(name);
    if (shadowed) await this.activate(shadowed);
  }

  dispose(): void {
    for (const name of [...this._active.keys()]) {
      this.deactivate(name).catch((error: unknown) =>
        this._logs.getLogger(`${name}(server)`).error('Server entry failed to deactivate', error),
      );
    }
  }

  /** Activates a plugin, stopping first another copy of the same name (it shadows it). */
  private async _replace(plugin: LocatedPlugin): Promise<void> {
    const name = plugin.manifest!.name;
    const current = this._active.get(name);
    if (current) {
      if (plugin.source === 'project' && current.plugin.source !== 'project')
        this._shadowed.set(name, current.plugin);
      await this._stop(name, undefined, false);
    }
    await this._activate(plugin);
  }

  /**
   * Stops a server entry; resolves with the plugin it was, or nothing when none ran. `wait`: let
   * an activation in progress finish first (not from inside that activation).
   */
  private async _stop(name: string, dir?: string, wait = true): Promise<LocatedPlugin | undefined> {
    if (wait) await this._activating.get(name);
    const active = this._active.get(name);
    if (!active || (dir && active.plugin.dir !== dir)) return undefined;
    this._active.delete(name);
    try {
      await active.module.deactivate?.();
    } finally {
      active.store.dispose();
    }
    return active.plugin;
  }

  private async _activate(plugin: LocatedPlugin): Promise<void> {
    const manifest = plugin.manifest!;
    const entry = manifest.entry.server!;
    const logger = this._logs.getLogger(`${manifest.name}(server)`);
    const store = new DisposableStore();
    const namespace = pluginNamespace(manifest.name);
    try {
      const url = pathToFileURL(join(plugin.dir, entry));
      url.searchParams.set('v', String(Date.now()));
      const imported = (await import(url.href)) as ServerPluginModule & {
        default?: ServerPluginModule;
      };
      const module = imported.default ?? imported;
      const context: ServerPluginContext = {
        name: manifest.name,
        manifest,
        subscriptions: store,
        logger,
        services: this._services,
        namespace,
        implement: (contract, implementation) => {
          if (contract.namespace !== namespace) {
            throw new Error(
              `${manifest.name} can only implement contracts in the "${namespace}" namespace`,
            );
          }
          return store.add(this._router.implement(contract, implementation));
        },
      };
      await module.activate?.(context);
      this._active.set(manifest.name, { plugin, module, store });
      logger.info('Server entry activated');
    } catch (error) {
      store.dispose();
      logger.error('Server entry failed to activate', error);
    }
  }
}
