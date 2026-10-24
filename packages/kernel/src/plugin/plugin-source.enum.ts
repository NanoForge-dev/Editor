/** Where a plugin comes from. Later sources shadow earlier ones with the same name. */
export const PLUGIN_SOURCE_ORDER = ['bundled', 'installed', 'project', 'dev'] as const;
export type PluginSourceKind = (typeof PLUGIN_SOURCE_ORDER)[number];
