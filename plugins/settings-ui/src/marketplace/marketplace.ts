import type { PluginScope } from '@nanoforge-dev/editor-sdk';

/** A plugin the host knows, reduced to what the marketplace needs. */
export interface KnownPlugin {
  readonly name: string;
  readonly version: string;
  readonly source: string;
}

/** A change made from the page, which the editor only follows after a reload. */
export type PendingChange = { version: string; scope: PluginScope } | 'removed';

export interface InstalledCopy {
  readonly version: string;
  /** Where it was installed from the marketplace; absent for built-in and dev plugins. */
  readonly scope?: PluginScope;
}

const SCOPES: Record<string, PluginScope> = { installed: 'user', project: 'project' };

/** The scope a plugin source stands for, when it is one the marketplace installs into. */
export const scopeOf = (source: string): PluginScope | undefined => SCOPES[source];

/**
 * The copy of a plugin the marketplace should speak of: what this page just did when it did
 * something, else the copy installed from the marketplace, else a built-in or dev one.
 */
export const installedCopy = (
  name: string,
  plugins: readonly KnownPlugin[],
  pending: ReadonlyMap<string, PendingChange>,
): InstalledCopy | undefined => {
  const change = pending.get(name);
  if (change === 'removed')
    return plugins.find((plugin) => plugin.name === name && !scopeOf(plugin.source));
  if (change) return change;
  const copies = plugins.filter((plugin) => plugin.name === name);
  const own =
    copies.find((plugin) => plugin.source === 'project') ??
    copies.find((plugin) => plugin.source === 'installed');
  if (own) return { version: own.version, scope: scopeOf(own.source)! };
  return copies[0] && { version: copies[0].version };
};

export type MarketAction = 'install' | 'update' | 'installed' | 'builtin' | 'unsupported';

/** What the marketplace offers for an item, given the newest version this editor can run. */
export const marketAction = (
  copy: InstalledCopy | undefined,
  compatible: string | undefined,
): MarketAction => {
  if (copy && !copy.scope) return 'builtin';
  if (!compatible) return copy ? 'installed' : 'unsupported';
  if (!copy) return 'install';
  return copy.version === compatible ? 'installed' : 'update';
};

export const SCOPE_LABEL: Record<PluginScope, string> = {
  user: 'for me',
  project: 'for this project',
};

/** `1.2k`, `3.4M`: download counts in a list. */
export const compactCount = (value: number): string =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    : value >= 1000
      ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
      : String(value);

/** `plugins.account`: the plugins installed for me, with version ranges. */
export const ACCOUNT_PLUGINS = 'plugins.account';
export type AccountPlugins = Readonly<Record<string, string>>;

/** The list with a plugin installed for me (its range follows the installed version). */
export const withAccountPlugin = (
  list: AccountPlugins,
  name: string,
  version: string,
): AccountPlugins =>
  Object.fromEntries(
    Object.entries({ ...list, [name]: `^${version}` }).sort(([a], [b]) => a.localeCompare(b)),
  );

export const withoutAccountPlugins = (
  list: AccountPlugins,
  names: readonly string[],
): AccountPlugins =>
  Object.fromEntries(Object.entries(list).filter(([name]) => !names.includes(name)));

/** The plugins of the account this editor does not have, from any source. */
export const missingAccountPlugins = (
  list: AccountPlugins,
  plugins: readonly KnownPlugin[],
): string[] =>
  Object.keys(list)
    .filter((name) => !plugins.some((plugin) => plugin.name === name))
    .sort();
