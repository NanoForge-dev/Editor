import type { Container } from '../di/container';
import type { Disposable, DisposableStore } from '../lifecycle/disposable';
import { type Observable, constant } from '../observable/observable';
import { CoreServices } from './core-services.const';
import { type AppInfo, eligibleApps } from './engine-libs';
import type { PluginContext } from './plugin-context.type';
import type { PluginDescriptor } from './plugin-resolution.type';

/**
 * The context handed to a plugin's `activate`: a child scope of `services`, and registrations
 * owned by the plugin, undone when `subscriptions` is disposed.
 */
export const createPluginContext = (
  services: Container,
  descriptor: PluginDescriptor,
  subscriptions: DisposableStore,
): PluginContext => {
  const { manifest } = descriptor;
  const scope = subscriptions.add(services.createChild(`plugin:${manifest.name}`));
  const extensions = services.get(CoreServices.Extensions);
  const commands = services.get(CoreServices.Commands);
  const i18n = services.get(CoreServices.Localization);
  const own = <T extends Disposable>(disposable: T) => subscriptions.add(disposable);
  const engineLibs = services.tryGet(CoreServices.EngineLibs);
  const apps: Observable<readonly AppInfo[]> = engineLibs
    ? eligibleApps(manifest, engineLibs.apps)
    : constant([]);

  return {
    name: manifest.name,
    manifest,
    source: descriptor.source,
    subscriptions,
    services: scope,
    scope,
    provide: (token, value, options) => own(services.provide(token, value, options)),
    provideFactory: (token, factory, options) =>
      own(services.provideFactory(token, factory, options)),
    override: (token, decorate, options) => own(services.override(token, decorate, options)),
    contribute: (point, value, options) =>
      own(extensions.contribute(point, value, { owner: manifest.name, ...options })),
    contributions: (point) => extensions.observe(point),
    registerCommand: (id, handler, metadata) =>
      own(commands.register({ ...metadata, id, handler, owner: manifest.name })),
    executeCommand: (id, ...args) => commands.execute(id, ...args),
    contextKeys: services.get(CoreServices.ContextKeys),
    logger: services.get(CoreServices.Logger).getLogger(manifest.name),
    t: i18n.scope(manifest.name),
    registerMessages: (locale, messages) =>
      own(i18n.registerBundle(manifest.name, locale, messages)),
    eligibleApps: apps,
    resolveAsset: (path) => new URL(path, descriptor.baseUrl).href,
  };
};
