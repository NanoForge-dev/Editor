import type { PluginModule } from './plugin-context.type';
import type { PluginModuleLoader } from './plugin-host.type';

/**
 * A plugin entry exports `activate`/`deactivate`, or a default export holding them
 * (`export default definePlugin({...})`).
 */
export const normalizePluginModule = (imported: unknown): PluginModule => {
  const module = (imported ?? {}) as PluginModule & { default?: unknown };
  if (module.activate || module.deactivate) return module;
  const fallback = module.default as PluginModule | undefined;
  return fallback && typeof fallback === 'object' ? fallback : {};
};

/** Loads client entries with a dynamic `import()` of `<baseUrl>/<entry.client>`. */
export const importPluginLoader: PluginModuleLoader = {
  async load(descriptor, generation) {
    const entry = descriptor.manifest.entry.client;
    if (!entry) return {};
    const url = new URL(entry, descriptor.baseUrl);
    if (generation > 0) url.searchParams.set('v', String(generation));
    return normalizePluginModule(await import(/* @vite-ignore */ url.href));
  },
};
