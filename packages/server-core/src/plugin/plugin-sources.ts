import { watch } from 'chokidar';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  Emitter,
  type Event,
  type Logger,
  PackageManifestSchema,
  type PluginManifest,
  parsePluginManifest,
} from '@nanoforge-dev/editor-kernel';
import type { PluginListing, PluginSuggestion } from '@nanoforge-dev/editor-protocol';

import type { EditorEnv } from '../env/editor-env.type';
import { PACKAGES_DIR } from '../fs/fs-service';
import { PathJail } from '../fs/path-jail';

export const MANIFEST_FILE = 'nanoforge.manifest.json';
export type PluginSourceKind = PluginListing['source'];

/** Where a project keeps its own plugins. */
export const PROJECT_PLUGINS_DIR = '.nanoforge/plugins';

/** How deep a package's `include` is followed (packages can include packages). */
const MAX_INCLUDE_DEPTH = 4;

/** The project whose plugins are listed: its id (for URLs) and its root folder. */
export interface PluginProject {
  readonly id: string;
  readonly root: string;
}

/** A plugin found on disk: `dir` holds the manifest and the built bundles. */
export interface LocatedPlugin {
  readonly source: PluginSourceKind;
  readonly dir: string;
  readonly manifest: PluginManifest | undefined;
  readonly listing: PluginListing;
}

const PROJECT_URL_PREFIX = '/plugins/project/';

const urlFor = (
  source: PluginSourceKind,
  manifest: { name: string; version: string },
  project?: PluginProject,
) =>
  source === 'project'
    ? `${PROJECT_URL_PREFIX}${project!.id}/${manifest.name}/${manifest.version}/`
    : `/plugins/${source}/${manifest.name}/${manifest.version}/`;

/**
 * Finds plugins in four places:
 *  - bundled with the editor (`<dir>/@<scope>/<name>`);
 *  - installed in the user's home (`<dataDir>/plugins/@<scope>/<name>`), for every project;
 *  - installed in the open project (`<project>/.nanoforge/plugins/@<scope>/<name>`);
 *  - local dev folders (`<path>/dist`).
 *
 * Packages (`nf_modules`) never hold plugins: they can only suggest some (`suggestions`).
 */
export class PluginSources {
  private _located = new Map<string, LocatedPlugin>();
  /** The project plugins last listed for each project, by base URL. */
  private readonly _projectLocated = new Map<string, Map<string, LocatedPlugin>>();
  private readonly _onDevChange = new Emitter<LocatedPlugin>({
    onFirstListenerAdd: () => this._watchDev(),
    onLastListenerRemove: () => void this._devWatcher?.close(),
  });
  private _devWatcher: ReturnType<typeof watch> | undefined;

  /** Fires when a dev plugin was rebuilt (debounced). */
  readonly onDevChange: Event<LocatedPlugin> = this._onDevChange.event;

  constructor(
    private readonly _env: EditorEnv,
    private readonly _logger: Logger,
  ) {}

  get installedDir(): string {
    return join(this._env.dataDir, 'plugins');
  }

  /** Every plugin, plus `project`'s own plugins when set. */
  async list(project?: PluginProject): Promise<LocatedPlugin[]> {
    const located: LocatedPlugin[] = [];
    await this._scan(located, 'bundled', this._env.bundledPluginsDir);
    await this._scan(located, 'installed', this.installedDir);
    for (const path of this._env.devPlugins)
      located.push(await this._read('dev', join(path, 'dist')));
    this._located = new Map(located.map((plugin) => [plugin.listing.baseUrl, plugin]));
    if (!project) return located;

    const own: LocatedPlugin[] = [];
    await this._scan(own, 'project', join(project.root, PROJECT_PLUGINS_DIR), project);
    this._projectLocated.set(
      project.id,
      new Map(own.map((plugin) => [plugin.listing.baseUrl, plugin])),
    );
    return [...located, ...own];
  }

  /**
   * The plugins that packages in the project's `nf_modules` suggest, merged by plugin name.
   * Reads each installed package's manifest and follows `include`, never scans.
   */
  async suggestions(projectRoot: string): Promise<PluginSuggestion[]> {
    const byName = new Map<string, PluginSuggestion>();
    const visit = async (dir: string, depth: number) => {
      let manifest;
      try {
        const raw: unknown = JSON.parse(await readFile(join(dir, MANIFEST_FILE), 'utf8'));
        if ((raw as { type?: unknown } | null)?.type !== 'package') return;
        manifest = PackageManifestSchema.parse(raw);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this._logger.warn(`Package at ${dir} ignored: ${message}`);
        return;
      }
      for (const [name, range] of Object.entries(manifest.suggestedPlugins)) {
        const entry = byName.get(name) ?? { name, suggestedBy: [] };
        entry.suggestedBy.push({ package: manifest.name, range });
        byName.set(name, entry);
      }
      if (depth >= MAX_INCLUDE_DEPTH) return;
      for (const include of manifest.include) await visit(join(dir, include), depth + 1);
    };
    const root = join(projectRoot, PACKAGES_DIR);
    for (const scope of await directories(root)) {
      for (const name of await directories(join(root, scope)))
        await visit(join(root, scope, name), 0);
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Absolute file of a plugin URL (`/plugins/<source>/@<scope>/<name>/<version>/<file>`, or
   * `/plugins/project/<projectId>/…` when `canAccess(projectId)`).
   */
  async resolveFile(
    urlPath: string,
    canAccess: (projectId: string) => boolean = () => false,
  ): Promise<{ file: string; plugin: LocatedPlugin } | undefined> {
    let located: Map<string, LocatedPlugin>;
    if (urlPath.startsWith(PROJECT_URL_PREFIX)) {
      const projectId = urlPath.slice(PROJECT_URL_PREFIX.length).split('/')[0] ?? '';
      if (!canAccess(projectId)) return undefined;
      located = this._projectLocated.get(projectId) ?? new Map();
    } else {
      if (!this._located.size) await this.list();
      located = this._located;
    }
    for (const [baseUrl, plugin] of located) {
      if (!urlPath.startsWith(baseUrl)) continue;
      const rel = decodeURIComponent(urlPath.slice(baseUrl.length));
      try {
        const file = await new PathJail(plugin.dir).resolve(rel);
        return existsSync(file) ? { file, plugin } : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private async _scan(
    into: LocatedPlugin[],
    source: PluginSourceKind,
    root: string | undefined,
    project?: PluginProject,
  ): Promise<void> {
    if (!root || !existsSync(root)) return;
    for (const scope of await directories(root)) {
      for (const name of await directories(join(root, scope))) {
        into.push(await this._read(source, join(root, scope, name), project));
      }
    }
  }

  private async _read(
    source: PluginSourceKind,
    dir: string,
    project?: PluginProject,
  ): Promise<LocatedPlugin> {
    const fallbackName = `${source}/${dir.split(/[\\/]/).slice(-2).join('-')}`;
    try {
      const raw: unknown = JSON.parse(await readFile(join(dir, MANIFEST_FILE), 'utf8'));
      const manifest = parsePluginManifest(raw, join(dir, MANIFEST_FILE));
      return {
        source,
        dir,
        manifest,
        listing: { source, baseUrl: urlFor(source, manifest, project), manifest: raw },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._logger.warn(`Plugin at ${dir} ignored: ${message}`);
      return {
        source,
        dir,
        manifest: undefined,
        listing: {
          source,
          baseUrl: `/plugins/invalid/${fallbackName}/`,
          manifest: null,
          error: message,
        },
      };
    }
  }

  private _watchDev(): void {
    if (!this._env.devPlugins.length) return;
    const dists = this._env.devPlugins.map((path) => join(path, 'dist'));
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    this._devWatcher = watch(dists, { ignoreInitial: true });
    this._devWatcher.on('all', (_event, file) => {
      const dist = dists.find((dir) => file.startsWith(dir));
      if (!dist) return;
      clearTimeout(timers.get(dist));
      timers.set(
        dist,
        setTimeout(async () => {
          const plugin = await this._read('dev', dist);
          this._located.set(plugin.listing.baseUrl, plugin);
          if (plugin.manifest) this._onDevChange.fire(plugin);
        }, 200),
      );
    });
  }
}

const directories = async (path: string): Promise<string[]> =>
  (await readdir(path, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
