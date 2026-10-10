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
  readonly module: ServerPluginModule;
  readonly store: DisposableStore;
}

/** Runs `entry.server` of enabled plugins inside the editor server (trusted plugins). */
export class ServerPluginHost implements Disposable {
  private readonly _active = new Map<string, ActiveServerPlugin>();
  /** Activations in progress: a second request for the same plugin waits for the first one. */
  private readonly _activating = new Map<string, Promise<void>>();

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
    if (!name || !plugin.manifest?.entry.server || this._active.has(name)) return Promise.resolve();
    let activating = this._activating.get(name);
    if (!activating) {
      activating = this._activate(plugin).finally(() => this._activating.delete(name));
      this._activating.set(name, activating);
    }
    return activating;
  }

  async deactivate(name: string): Promise<void> {
    await this._activating.get(name);
    const plugin = this._active.get(name);
    if (!plugin) return;
    this._active.delete(name);
    try {
      await plugin.module.deactivate?.();
    } finally {
      plugin.store.dispose();
    }
  }

  dispose(): void {
    for (const name of [...this._active.keys()]) {
      this.deactivate(name).catch((error: unknown) =>
        this._logs.getLogger(`${name}(server)`).error('Server entry failed to deactivate', error),
      );
    }
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
      this._active.set(manifest.name, { module, store });
      logger.info('Server entry activated');
    } catch (error) {
      store.dispose();
      logger.error('Server entry failed to activate', error);
    }
  }
}
