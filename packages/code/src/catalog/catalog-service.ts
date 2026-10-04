import {
  type Disposable,
  DisposableStore,
  type Observable,
  ObservableValue,
  type PluginHost,
  createToken,
} from '@nanoforge-dev/editor-kernel';
import type { MetaDiagnostic } from '@nanoforge-dev/editor-meta';
import {
  type ItemMeta,
  type ItemRef,
  META_GENERATOR,
  META_NOTICE,
  META_VERSION,
  MetaFile,
  type MetaSource,
  metaCachePath,
  sourceHash,
  sourceRefBase,
} from '@nanoforge-dev/editor-meta/pure';
import type { AppModel } from '@nanoforge-dev/editor-protocol';

import type { MetaRoot, MetaSourceFile } from '../engine/extract-meta';
import { isCodeFile } from '../service/code-service';
import type { CatalogItem, CatalogOptions, CatalogState } from './catalog.type';
import { appRefName, itemFitsApp, within } from './item-fits-app';

interface Source {
  readonly source: MetaSource;
  /** Folder of the source; its files are the code files under it. */
  readonly root: string;
  readonly files: readonly MetaSourceFile[];
}

const MANIFEST = 'nanoforge.manifest.json';
const MODULES = 'nf_modules';
const EDITOR_GITIGNORE = '.nanoforge/editor/.gitignore';
const EXPECTED_OWNERS_TIMEOUT_MS = 5000;

/**
 * Items (components, systems…) of the open project and its installed packages (ADR 0003). Each
 * source's meta is cached in `.nanoforge/editor/cache/meta/`, used while its sources and owners
 * are unchanged, and extracted again by the code worker otherwise.
 */
export class CatalogService implements Disposable {
  private readonly _state = new ObservableValue<CatalogState>({
    items: [],
    diagnostics: [],
    loading: true,
  });
  private readonly _store = new DisposableStore();
  private readonly _bySource = new Map<
    string,
    { items: CatalogItem[]; diagnostics: MetaDiagnostic[] }
  >();
  private readonly _dirty = new Set<string>();
  private _sources: Source[] = [];
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _running: Promise<void> = Promise.resolve();
  private _disposed = false;
  /** The catalog starts (and starts the code worker) when first read. */
  private _active = false;

  constructor(private readonly _options: CatalogOptions) {
    const { project, documents, plugins } = _options;
    this._store.add({
      dispose: project.model.subscribe(() => this._scheduleAll()),
    });
    this._store.add(
      project.fs.onDidChange((changes) => {
        for (const change of changes) {
          if (change.path.endsWith(MANIFEST) && within(change.path, MODULES)) this._scheduleAll();
          else if (isCodeFile(change.path) && change.type !== 'changed') this._scheduleAll();
          else if (isCodeFile(change.path)) this._schedulePath(change.path);
        }
      }),
    );
    this._store.add(documents.onDidChange(({ uri }) => this._schedulePath(uri)));
    if (plugins) {
      let owners = ownerPlugins(plugins);
      this._store.add(
        plugins.onDidChange(() => {
          const next = ownerPlugins(plugins);
          if (next === owners) return;
          owners = next;
          this._scheduleAll();
        }),
      );
    }
  }

  get state(): Observable<CatalogState> {
    this._activate();
    return this._state.readonly();
  }

  get items(): readonly CatalogItem[] {
    this._activate();
    return this._state.get().items;
  }

  get(ref: ItemRef): CatalogItem | undefined {
    return this.items.find((item) => item.ref === ref);
  }

  /** The items an app can use: its own, shared libraries' and installed packages'. */
  forApp(app: AppModel): CatalogItem[] {
    return this.items.filter((item) => itemFitsApp(item, app));
  }

  /** The item a source file's export is, if any. */
  itemAt(path: string, exportName: string): CatalogItem | undefined {
    return this.items.find((item) => item.meta.source === path && item.meta.export === exportName);
  }

  /** Extracts everything again (after an owner plugin changed, or on demand). */
  refresh(): Promise<void> {
    this._active = true;
    this._scheduleAll(0);
    return this.whenIdle();
  }

  /** Resolves once pending extractions are done. */
  async whenIdle(): Promise<void> {
    while (this._timer !== undefined || this._dirty.size) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await this._running;
    }
    await this._running;
  }

  dispose(): void {
    this._disposed = true;
    clearTimeout(this._timer);
    this._store.dispose();
  }

  private _activate(): void {
    if (this._active) return;
    this._active = true;
    this._scheduleAll(0);
  }

  private _scheduleAll(delay = this._options.delayMs ?? 300): void {
    this._dirty.add('*');
    this._schedule(delay);
  }

  private _schedulePath(path: string): void {
    if (!isCodeFile(path)) return;
    const source = this._sources.find((candidate) => within(path, candidate.root));
    if (!source && !within(path, MODULES)) {
      return;
    }
    this._dirty.add(source ? sourceRefBase(source.source) : '*');
    this._schedule(this._options.delayMs ?? 300);
  }

  private _schedule(delay: number): void {
    if (!this._active) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = undefined;
      this._running = this._running
        .then(() => this._run())
        .catch((error: unknown) => this._options.logger?.error('Catalog update failed', error));
    }, delay);
  }

  private async _run(): Promise<void> {
    if (this._disposed || !this._dirty.size) return;
    const all = this._dirty.has('*');
    const dirty = new Set(this._dirty);
    this._dirty.clear();
    if (all) this._sources = await this._discover();
    await this._expectedOwners();
    const owners = await this._options.code.itemOwners();
    const roots: MetaRoot[] = this._sources.map((source) => ({
      path: source.root,
      ref: sourceRefBase(source.source),
    }));
    const known = new Set(this._sources.map((source) => sourceRefBase(source.source)));
    for (const key of this._bySource.keys()) if (!known.has(key)) this._bySource.delete(key);
    for (const source of this._sources) {
      if (this._disposed) return;
      const key = sourceRefBase(source.source);
      if (!all && !dirty.has(key) && this._bySource.has(key)) continue;
      try {
        this._bySource.set(key, await this._load(source, roots, owners));
      } catch (error) {
        this._options.logger?.warn(`Items of ${key} could not be read`, error);
      }
    }
    this._publish();
  }

  private _publish(): void {
    const entries = [...this._bySource.values()];
    this._state.set({
      items: entries.flatMap((entry) => entry.items),
      diagnostics: entries.flatMap((entry) => entry.diagnostics),
      loading: false,
    });
  }

  /** Waits (a few seconds at most) for the worker to register the owners plugins declare. */
  private async _expectedOwners(): Promise<void> {
    const plugins = this._options.plugins;
    if (!plugins) return;
    const expected = ownerPlugins(plugins).split(',').filter(Boolean);
    const deadline = Date.now() + EXPECTED_OWNERS_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const registered = new Set(
        (await this._options.code.itemOwners()).map((owner) => owner.name),
      );
      if (expected.every((name) => registered.has(name))) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this._options.logger?.warn(`Item owners not registered in time: ${expected.join(', ')}`);
  }

  /** Apps, shared libraries and installed packages (walking `include`), with their files. */
  private async _discover(): Promise<Source[]> {
    const { project } = this._options;
    const entries = project.fs.entries;
    const codeFiles = (root: string) =>
      entries
        .filter(
          (entry) => entry.kind === 'file' && isCodeFile(entry.path) && within(entry.path, root),
        )
        .map((entry) => entry.path);
    const sources: Source[] = [];

    for (const app of project.model.get().apps) {
      const folderOf = (path: string): MetaSourceFile['folder'] =>
        within(path, app.dirs.components)
          ? 'components'
          : within(path, app.dirs.systems)
            ? 'systems'
            : undefined;
      const source: MetaSource =
        app.type === 'lib'
          ? { kind: 'lib', name: app.name, path: app.root }
          : { kind: 'app', name: appRefName(app), path: app.root };
      sources.push({
        source,
        root: app.root,
        files: codeFiles(app.root)
          .filter((path) => !within(path, MODULES))
          .map((path) => {
            const folder = folderOf(path);
            return { path, ...(folder && { folder }) };
          }),
      });
    }

    const visit = async (dir: string, depth: number) => {
      const manifestPath = `${dir}/${MANIFEST}`;
      if (!project.fs.entry(manifestPath) || depth > 4) return;
      let manifest: {
        type?: string;
        name?: string;
        version?: string;
        items?: unknown;
        include?: unknown;
      };
      try {
        manifest = JSON.parse((await project.fs.readText(manifestPath)).text) as typeof manifest;
      } catch {
        return;
      }
      if (manifest.type !== 'package' || !manifest.name) return;
      const listed = Array.isArray(manifest.items)
        ? manifest.items.filter((item): item is string => typeof item === 'string')
        : [];
      sources.push({
        source: {
          kind: 'module',
          name: manifest.name,
          version: manifest.version ?? '0.0.0',
          path: dir,
        },
        root: dir,
        files: listed
          .filter((item) => !item.split('/').includes('..'))
          .map((item) => ({ path: `${dir}/${item}`, listed: true })),
      });
      const includes = Array.isArray(manifest.include) ? manifest.include : [];
      for (const include of includes)
        if (typeof include === 'string' && !include.split('/').includes('..'))
          await visit(`${dir}/${include}`, depth + 1);
    };
    const scopes = entries.filter(
      (entry) => entry.kind === 'directory' && /^nf_modules\/@[^/]+$/.test(entry.path),
    );
    for (const scope of scopes) {
      const names = entries.filter(
        (entry) =>
          entry.kind === 'directory' &&
          entry.path.startsWith(`${scope.path}/`) &&
          !entry.path.slice(scope.path.length + 1).includes('/'),
      );
      for (const name of names) await visit(name.path, 0);
    }
    return sources;
  }

  /** A source's items: from the cache when still valid, else extracted and cached. */
  private async _load(
    source: Source,
    roots: readonly MetaRoot[],
    owners: readonly { name: string; version: string; schema: number }[],
  ): Promise<{ items: CatalogItem[]; diagnostics: MetaDiagnostic[] }> {
    const { project, documents, code } = this._options;
    const cachePath = metaCachePath(source.source);
    const texts = await Promise.all(
      source.files.map(async (file) => ({
        path: file.path,
        text: await documents.getText(file.path),
      })),
    );
    const hash = await sourceHash(texts);
    const ownerTable = Object.fromEntries(
      owners.map((owner) => [owner.name, { version: owner.version, schema: owner.schema }]),
    );

    const cached = await this._readCache(cachePath);
    const fresh =
      cached &&
      cached.sourceHash === hash &&
      cached.generator.version === META_GENERATOR.version &&
      JSON.stringify(sortKeys(cached.owners)) === JSON.stringify(sortKeys(ownerTable));
    let items: ItemMeta[];
    let diagnostics: MetaDiagnostic[] = [];
    if (fresh) {
      items = cached.items;
    } else {
      const result = await code.extractMeta({
        source: source.source,
        files: source.files,
        roots,
        texts,
      });
      items = result.items;
      diagnostics = result.diagnostics;
      const file: MetaFile = {
        generated: META_NOTICE,
        metaVersion: META_VERSION,
        generator: { ...META_GENERATOR },
        source: source.source,
        sourceHash: result.sourceHash,
        owners: result.owners,
        items,
      };
      await this._ensureIgnored();
      await project.fs
        .write(cachePath, `${JSON.stringify(file, null, 2)}\n`)
        .catch((error: unknown) =>
          this._options.logger?.warn(`Could not cache ${cachePath}`, error),
        );
    }
    const base = sourceRefBase(source.source);
    return {
      items: items.map((meta) => ({
        ref: `${base}#${meta.export}`,
        source: source.source,
        meta,
        readonly: source.source.kind === 'module',
      })),
      diagnostics,
    };
  }

  private async _readCache(path: string): Promise<MetaFile | undefined> {
    if (!this._options.project.fs.entry(path)) return undefined;
    try {
      const parsed = MetaFile.safeParse(
        JSON.parse((await this._options.project.fs.readText(path)).text),
      );
      return parsed.success ? parsed.data : undefined;
    } catch {
      return undefined;
    }
  }

  /** The cache is never committed: `cache/` in `.nanoforge/editor/.gitignore`. */
  private async _ensureIgnored(): Promise<void> {
    const fs = this._options.project.fs;
    const current = fs.entry(EDITOR_GITIGNORE) ? await fs.readText(EDITOR_GITIGNORE) : undefined;
    const lines = current?.text.split('\n').map((line) => line.trim()) ?? [];
    if (lines.includes('cache/')) return;
    const text = `${current?.text.trimEnd() ?? ''}${current?.text.trim() ? '\n' : ''}cache/\n`;
    await fs.write(EDITOR_GITIGNORE, text).catch(() => undefined);
  }
}

/** Plugins that declare an item owner and have a worker entry, as `name@version,…`. */
const ownerPlugins = (plugins: PluginHost): string =>
  plugins
    .getPlugins()
    .filter(
      (plugin) =>
        plugin.status.kind === 'ok' &&
        plugin.descriptor.manifest.entry.worker &&
        (plugin.descriptor.manifest.contributes as Record<string, unknown>).itemOwner,
    )
    .map((plugin) => plugin.name)
    .sort()
    .join(',');

const sortKeys = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));

export const CatalogServiceToken = createToken<CatalogService>('code.catalog');
