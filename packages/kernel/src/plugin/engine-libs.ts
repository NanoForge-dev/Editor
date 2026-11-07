import semver from 'semver';

import type { ContextKeyService } from '../context/context-key-service';
import { type Disposable, DisposableStore, toDisposable } from '../lifecycle/disposable';
import { type Observable, derived } from '../observable/observable';
import type { PluginManifest } from './plugin-manifest';

export type AppType = 'client' | 'server' | 'lib';

/** An app of the opened game workspace, as discovered by the project service. */
export interface AppInfo {
  readonly id: string;
  readonly name: string;
  readonly type: AppType;
  /** Installed engine libraries and their versions, e.g. `{ '@nanoforge-dev/ecs': '1.4.2' }`. */
  readonly engineLibs: Readonly<Record<string, string>>;
}

/** Provided by the project service (phase 2). */
export interface EngineLibProvider {
  readonly apps: Observable<readonly AppInfo[]>;
}

export interface MissingEngineLib {
  readonly name: string;
  readonly range: string;
  /** Installed version when present but out of range. */
  readonly installed?: string;
}

/** Required engine libs of a plugin that an app lacks (empty = eligible). */
export const missingEngineLibs = (manifest: PluginManifest, app: AppInfo): MissingEngineLib[] =>
  Object.entries(manifest.engineLibs.required).flatMap(([name, range]) => {
    const installed = app.engineLibs[name];
    if (!installed) return [{ name, range }];
    const version = semver.valid(installed) ?? semver.coerce(installed)?.version;
    if (!version || semver.satisfies(version, range)) return [];
    return [{ name, range, installed }];
  });

export const isEligible = (manifest: PluginManifest, app: AppInfo): boolean =>
  missingEngineLibs(manifest, app).length === 0;

export const eligibleApps = (
  manifest: PluginManifest,
  apps: Observable<readonly AppInfo[]>,
): Observable<readonly AppInfo[]> =>
  derived(
    [apps],
    (list) => list.filter((app) => isEligible(manifest, app)),
    (a, b) => a.length === b.length && a.every((app, i) => app === b[i]),
  );

/** Context key holding the id of the app the user is working on. */
export const ACTIVE_APP_KEY = 'activeApp';
export const engineLibKey = (lib: string) => `engineLib:${lib}`;
export const pluginEligibleKey = (plugin: string) => `plugin.${plugin}.eligible`;

/**
 * Keeps `engineLib:<pkg>` and `plugin.<name>.eligible` context keys in sync with the active app,
 * so `when` clauses can gate features on installed engine libraries.
 */
export const bindEngineLibContext = (
  context: ContextKeyService,
  apps: Observable<readonly AppInfo[]>,
  plugins: () => readonly PluginManifest[],
): Disposable => {
  const store = new DisposableStore();
  const bound = new DisposableStore();
  store.add(bound);

  const refresh = () => {
    bound.clear();
    const activeId = context.get<string>(ACTIVE_APP_KEY);
    const app = apps.get().find((candidate) => candidate.id === activeId);
    if (!app) return;
    for (const lib of Object.keys(app.engineLibs)) bound.add(context.bind(engineLibKey(lib), true));
    for (const manifest of plugins()) {
      bound.add(context.bind(pluginEligibleKey(manifest.name), isEligible(manifest, app)));
    }
  };

  store.add(toDisposable(apps.subscribe(refresh)));
  store.add(
    context.onDidChange(({ keys }) => {
      if (keys.has(ACTIVE_APP_KEY)) refresh();
    }),
  );
  return store;
};
