import { createToken } from '../di/service-token';
import { Emitter, type Event } from '../event/emitter';
import { type Disposable, DisposableStore, toDisposable } from '../lifecycle/disposable';
import type { Logger } from '../log/logger.type';
import { type Observable } from '../observable/observable';
import { COMMAND_METADATA } from './command-metadata';
import { CoreServices } from './core-services.const';
import { createPluginContext } from './create-plugin-context';
import { describeStatus } from './describe-status';
import { bindEngineLibContext } from './engine-libs';
import { PluginActivationError } from './plugin-activation.exception';
import type { PluginModule } from './plugin-context.type';
import type {
  PluginHostOptions,
  PluginInfo,
  PluginModuleLoader,
  PluginState,
  StaticContributionHandler,
} from './plugin-host.type';
import type { CommandContribution } from './plugin-manifest';
import { importPluginLoader } from './plugin-module-loader';
import type { PluginDescriptor, PluginStatus, Resolution } from './plugin-resolution.type';
import { resolvePlugins } from './resolve-plugins';

interface PluginRecord {
  descriptor: PluginDescriptor;
  status: PluginStatus;
  state: PluginState;
  error?: unknown;
  generation: number;
  module?: PluginModule;
  context?: DisposableStore;
  staticContributions: DisposableStore;
  pending?: Promise<void>;
}

export class PluginHost implements Disposable {
  private readonly _records = new Map<string, PluginRecord>();
  private readonly _handlers = new Map<string, StaticContributionHandler>();
  private readonly _store = new DisposableStore();
  private readonly _onDidChange = new Emitter<void>();
  private readonly _logger: Logger;
  private readonly _loader: PluginModuleLoader;
  private _resolution: Resolution | undefined;

  readonly onDidChange: Event<void> = this._onDidChange.event;

  constructor(private readonly _options: PluginHostOptions) {
    this._loader = _options.loader ?? importPluginLoader;
    this._logger = this._options.services.get(CoreServices.Logger).getLogger('kernel.plugins');
    this._store.add(
      this.registerContributionHandler<CommandContribution[]>({
        key: 'commands',
        apply: (commands, plugin) => {
          const store = new DisposableStore();
          for (const command of commands) {
            store.add(
              this._options.services
                .get(CoreServices.Extensions)
                .contribute(
                  COMMAND_METADATA,
                  { ...command, owner: plugin.manifest.name },
                  { owner: plugin.manifest.name },
                ),
            );
          }
          return store;
        },
      }),
    );
    this._options.services
      .get(CoreServices.Commands)
      .setActivator((id) => this.activateByEvent(`onCommand:${id}`));
  }

  registerContributionHandler<T>(handler: StaticContributionHandler<T>): Disposable {
    if (this._handlers.has(handler.key)) {
      throw new Error(`A handler for contributes.${handler.key} is already registered`);
    }
    this._handlers.set(handler.key, handler as StaticContributionHandler);
    for (const record of this._records.values()) {
      if (record.status.kind === 'ok')
        this._applyContribution(record, handler as StaticContributionHandler);
    }
    return toDisposable(() => this._handlers.delete(handler.key));
  }

  get resolution(): Resolution | undefined {
    return this._resolution;
  }

  getPlugin(name: string): PluginInfo | undefined {
    const record = this._records.get(name);
    return record && this._info(name, record);
  }

  getPlugins(): PluginInfo[] {
    return [...this._records].map(([name, record]) => this._info(name, record));
  }

  get plugins(): Observable<PluginInfo[]> {
    return {
      get: () => this.getPlugins(),
      subscribe: (run) => {
        run(this.getPlugins());
        const subscription = this.onDidChange(() => run(this.getPlugins()));
        return () => subscription.dispose();
      },
    };
  }

  /** Resolves plugins, applies their static contributions and activates `onStartup` ones. */
  async start(descriptors: readonly PluginDescriptor[]): Promise<void> {
    if (this._resolution) throw new Error('Plugin host already started');
    this._resolution = resolvePlugins(descriptors, this._options);
    for (const [name, resolved] of this._resolution.plugins) {
      const record: PluginRecord = {
        descriptor: resolved.descriptor,
        status: resolved.status,
        state: 'inactive',
        generation: 0,
        staticContributions: new DisposableStore(),
      };
      this._records.set(name, record);
      if (resolved.status.kind !== 'ok') {
        this._logger.warn(`Plugin "${name}" not loaded: ${describeStatus(resolved.status)}`);
      }
    }
    for (const descriptor of this._resolution.order) {
      this._applyStaticContributions(this._records.get(descriptor.manifest.name)!);
    }
    const apps = this._options.services.tryGet(CoreServices.EngineLibs)?.apps;
    if (apps) {
      this._store.add(
        bindEngineLibContext(this._options.services.get(CoreServices.ContextKeys), apps, () =>
          this._resolution!.order.map((d) => d.manifest),
        ),
      );
    }
    this._onDidChange.fire();
    await this.activateByEvent('onStartup');
  }

  /**
   * Replaces the set of plugins (a project with its own plugins was opened or closed). Plugins
   * that left, changed source or stopped resolving are deactivated and removed; new ones get
   * their static contributions. Plugins that were active and still resolve are re-activated,
   * then `onStartup` plugins are activated.
   */
  async update(descriptors: readonly PluginDescriptor[]): Promise<void> {
    if (!this._resolution) throw new Error('Plugin host not started');
    const next = resolvePlugins(descriptors, this._options);
    const wasActive = new Set(
      [...this._records].filter(([, record]) => record.state === 'active').map(([name]) => name),
    );
    const changed = [...this._records].filter(([name, record]) => {
      const resolved = next.plugins.get(name);
      return (
        !resolved ||
        resolved.descriptor.baseUrl !== record.descriptor.baseUrl ||
        resolved.descriptor.manifest.version !== record.descriptor.manifest.version ||
        resolved.status.kind !== record.status.kind
      );
    });
    for (const [name] of changed) await this.deactivate(name);
    for (const [name, record] of changed) {
      this._records.delete(name);
      this._cleanup(name, record);
      record.staticContributions.dispose();
    }

    this._resolution = next;
    const fresh = new Set<string>();
    for (const [name, resolved] of next.plugins) {
      if (this._records.has(name)) continue;
      fresh.add(name);
      this._records.set(name, {
        descriptor: resolved.descriptor,
        status: resolved.status,
        state: 'inactive',
        generation: 0,
        staticContributions: new DisposableStore(),
      });
      if (resolved.status.kind !== 'ok') {
        this._logger.warn(`Plugin "${name}" not loaded: ${describeStatus(resolved.status)}`);
      }
    }
    for (const descriptor of next.order) {
      if (fresh.has(descriptor.manifest.name))
        this._applyStaticContributions(this._records.get(descriptor.manifest.name)!);
    }
    this._onDidChange.fire();

    const reactivate = [...wasActive].filter(
      (name) => this._records.get(name)?.status.kind === 'ok',
    );
    const results = await Promise.allSettled(reactivate.map((name) => this.activate(name)));
    for (const result of results) {
      if (result.status === 'rejected') this._logger.error(String(result.reason));
    }
    await this.activateByEvent('onStartup');
  }

  /** Activates every inactive plugin listening to `event` (dependencies first). */
  async activateByEvent(event: string): Promise<void> {
    const targets = (this._resolution?.order ?? [])
      .map((descriptor) => descriptor.manifest)
      .filter((manifest) => manifest.activation.includes(event))
      .map((manifest) => manifest.name);
    const results = await Promise.allSettled(targets.map((name) => this.activate(name)));
    for (const result of results) {
      if (result.status === 'rejected') this._logger.error(String(result.reason));
    }
  }

  /** Activates a plugin and its dependencies. Concurrent calls share the same activation. */
  activate(name: string): Promise<void> {
    const record = this._records.get(name);
    if (!record) return Promise.reject(new Error(`Unknown plugin "${name}"`));
    if (record.status.kind !== 'ok') {
      return Promise.reject(new PluginActivationError(name, describeStatus(record.status)));
    }
    if (record.state === 'active') return Promise.resolve();
    if (record.state === 'failed')
      return Promise.reject(new PluginActivationError(name, record.error));
    record.pending ??= this._activate(name, record).finally(() => {
      record.pending = undefined;
    });
    return record.pending;
  }

  /** Deactivates a plugin after its active dependents. */
  async deactivate(name: string): Promise<void> {
    const record = this._records.get(name);
    if (!record || (record.state !== 'active' && record.state !== 'failed')) return;
    for (const dependent of this._dependents(name)) await this.deactivate(dependent);
    if (record.state === 'failed') {
      record.state = 'inactive';
      record.error = undefined;
      this._onDidChange.fire();
      return;
    }
    record.state = 'deactivating';
    this._onDidChange.fire();
    try {
      await record.module?.deactivate?.();
    } catch (error) {
      this._logger.error(`Plugin "${name}" failed to deactivate`, error);
    }
    this._cleanup(name, record);
    record.state = 'inactive';
    this._onDidChange.fire();
  }

  /**
   * Hot reload (local dev plugins): deactivates the plugin and its dependents, re-applies its
   * static contributions from the new manifest, re-imports its code and re-activates what was
   * active before.
   */
  async reload(name: string, descriptor?: PluginDescriptor): Promise<void> {
    const record = this._records.get(name);
    if (!record) throw new Error(`Unknown plugin "${name}"`);
    const wasActive = [name, ...this._dependentsDeep(name)].filter(
      (plugin) => this._records.get(plugin)?.state === 'active',
    );
    await this.deactivate(name);
    if (descriptor) record.descriptor = descriptor;
    record.generation++;
    record.module = undefined;
    record.state = 'inactive';
    record.staticContributions.clear();
    if (record.status.kind === 'ok') this._applyStaticContributions(record);
    for (const plugin of wasActive) await this.activate(plugin);
  }

  dispose(): void {
    for (const [name, record] of this._records) {
      if (record.state === 'active') {
        try {
          void record.module?.deactivate?.();
        } catch (error) {
          this._logger.error(`Plugin "${name}" failed to deactivate`, error);
        }
      }
      this._cleanup(name, record);
      record.staticContributions.dispose();
    }
    this._records.clear();
    this._options.services.get(CoreServices.Commands).setActivator(undefined);
    this._store.dispose();
    this._onDidChange.dispose();
  }

  private async _activate(name: string, record: PluginRecord): Promise<void> {
    const { manifest } = record.descriptor;
    for (const dependency of Object.keys(manifest.dependencies)) {
      await this.activate(dependency);
    }
    for (const dependency of Object.keys(manifest.optionalDependencies)) {
      if (this._records.get(dependency)?.status.kind === 'ok') {
        await this.activate(dependency).catch(() => undefined);
      }
    }
    record.state = 'activating';
    this._onDidChange.fire();
    const store = new DisposableStore();
    record.context = store;
    try {
      record.module ??= await this._loader.load(record.descriptor, record.generation);
      const context = createPluginContext(this._options.services, record.descriptor, store);
      await withTimeout(
        Promise.resolve(record.module.activate?.(context)),
        this._options.activationTimeoutMs ?? 10_000,
        `activation of "${name}" timed out`,
      );
      record.state = 'active';
      this._logger.info(`Plugin "${name}" activated`);
      this._onDidChange.fire();
    } catch (error) {
      this._cleanup(name, record);
      record.state = 'failed';
      record.error = error;
      this._logger.error(`Plugin "${name}" failed to activate`, error);
      this._onDidChange.fire();
      throw new PluginActivationError(name, error);
    }
  }

  private _cleanup(name: string, record: PluginRecord): void {
    try {
      record.context?.dispose();
    } catch (error) {
      this._logger.error(`Errors while disposing plugin "${name}"`, error);
    }
    record.context = undefined;
    this._options.services.get(CoreServices.Extensions).removeOwner(name);
    record.staticContributions.clear();
    if (record.status.kind === 'ok' && this._records.has(name)) {
      this._applyStaticContributions(record);
    }
  }

  private _applyStaticContributions(record: PluginRecord): void {
    const { contributes, name } = record.descriptor.manifest;
    for (const key of Object.keys(contributes)) {
      const handler = this._handlers.get(key);
      if (handler) this._applyContribution(record, handler);
      else this._logger.debug(`No handler yet for contributes.${key} of "${name}"`);
    }
  }

  private _applyContribution(record: PluginRecord, handler: StaticContributionHandler): void {
    const { manifest } = record.descriptor;
    const raw = (manifest.contributes as Record<string, unknown>)[handler.key];
    if (raw === undefined) return;
    try {
      const value = handler.validator ? handler.validator.parse(raw) : raw;
      record.staticContributions.add(handler.apply(value, record.descriptor));
    } catch (error) {
      this._logger.error(`Invalid contributes.${handler.key} of "${manifest.name}"`, error);
    }
  }

  /** Active or activating plugins depending (required or optional) on `name`. */
  private _dependents(name: string): string[] {
    return [...this._records]
      .filter(([, record]) => {
        const { dependencies, optionalDependencies } = record.descriptor.manifest;
        return (
          (record.state === 'active' || record.state === 'failed') &&
          (name in dependencies || name in optionalDependencies)
        );
      })
      .map(([dependent]) => dependent);
  }

  private _dependentsDeep(name: string, seen = new Set<string>()): string[] {
    for (const dependent of this._dependents(name)) {
      if (seen.has(dependent)) continue;
      seen.add(dependent);
      this._dependentsDeep(dependent, seen);
    }
    return [...seen];
  }

  private _info(name: string, record: PluginRecord): PluginInfo {
    return {
      name,
      descriptor: record.descriptor,
      status: record.status,
      state: record.state,
      ...(record.error === undefined ? {} : { error: record.error }),
    };
  }
}

const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/** The plugin host of the editor (plugin list, enable state), e.g. for a plugins page. */
export const PluginHostToken = createToken<PluginHost>('core.pluginHost');
