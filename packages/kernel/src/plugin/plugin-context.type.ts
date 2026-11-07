import type { CommandHandler, CommandMetadata } from '../command/command.type';
import type { ContextKeyService } from '../context/context-key-service';
import type { Container } from '../di/container';
import type {
  ProvideOptions,
  ServiceAccessor,
  ServiceDecorator,
  ServiceFactory,
} from '../di/container.type';
import type { ServiceToken } from '../di/service-token';
import type { Contribution, ExtensionPoint } from '../extension/extension-point.type';
import type { MessageBundle } from '../i18n/localization-service';
import type { MessageParams } from '../i18n/message-format';
import type { Disposable, DisposableStore } from '../lifecycle/disposable';
import type { Logger } from '../log/logger.type';
import type { Observable } from '../observable/observable';
import type { AppInfo } from './engine-libs';
import type { PluginManifest } from './plugin-manifest';
import type { PluginSourceKind } from './plugin-source.enum';

/**
 * What a plugin receives on activation. Everything registered through it is tied to the plugin
 * lifetime: deactivating the plugin disposes it all.
 */
export interface PluginContext {
  readonly name: string;
  readonly manifest: PluginManifest;
  readonly source: PluginSourceKind;
  /** Disposed when the plugin deactivates; add your own disposables here. */
  readonly subscriptions: DisposableStore;

  /** Resolves services: plugin-private ones first, then the editor's. */
  readonly services: ServiceAccessor;
  /** Plugin-private container (not visible to other plugins). */
  readonly scope: Container;
  readonly contextKeys: ContextKeyService;
  readonly logger: Logger;
  /** Apps of the project that have every engine lib this plugin requires. */
  readonly eligibleApps: Observable<readonly AppInfo[]>;

  /** Provides a service to the whole editor (other plugins included). */
  provide<T>(token: ServiceToken<T>, value: T, options?: ProvideOptions): Disposable;
  provideFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: ProvideOptions,
  ): Disposable;
  /** Decorates an editor service, e.g. to extend a core feature. */
  override<T>(
    token: ServiceToken<T>,
    decorate: ServiceDecorator<T>,
    options?: ProvideOptions,
  ): Disposable;

  contribute<T>(point: ExtensionPoint<T>, value: T, options?: { priority?: number }): Disposable;
  contributions<T>(point: ExtensionPoint<T>): Observable<readonly Contribution<T>[]>;

  registerCommand<A extends unknown[], R>(
    id: string,
    handler: CommandHandler<A, R>,
    metadata?: CommandMetadata,
  ): Disposable;
  executeCommand<R = unknown>(id: string, ...args: unknown[]): Promise<R>;

  /** Translates a key of this plugin's namespace. */
  t(key: string, params?: MessageParams): string;
  registerMessages(locale: string, messages: MessageBundle): Disposable;

  /** Absolute URL of a file shipped in the plugin package. */
  resolveAsset(path: string): string;
}

/** What a plugin's client entry exports (see `definePlugin` in the SDK). */
export interface PluginModule {
  activate?(context: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
