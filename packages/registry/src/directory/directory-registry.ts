import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import semver from 'semver';

import { sha256, zipFolder } from '../archive/archive';
import {
  ItemManifest,
  ItemName,
  MANIFEST_FILE,
  type RegistryItem,
  type RegistrySummary,
  type RegistryVersion,
  SearchQuery,
  type SearchResult,
} from '../item/item.schema';
import { RegistryError } from '../registry/registry.exception';
import type { Registry } from '../registry/registry.type';

interface Entry {
  readonly item: RegistryItem;
  /** Folder of each version. */
  readonly folders: ReadonlyMap<string, string>;
}

/**
 * A registry read from a folder, for tests and for working without the real one:
 * `<dir>/@scope/name/<version>/` holds the files of each version (its manifest, and a
 * `README.md`), and `<dir>/@scope/name/registry.json` the optional `{ author, downloads }`.
 * Version folders added or removed are followed; call `reload()` after changing files inside one.
 */
export class DirectoryRegistry implements Registry {
  private _entries: Promise<Map<string, Entry>> | undefined;
  private _listed = '';
  private readonly _archives = new Map<string, Promise<Uint8Array>>();

  constructor(readonly dir: string) {}

  /** Reads the folder again on the next call (it changed). */
  reload(): void {
    this._entries = undefined;
    this._archives.clear();
  }

  async search(query: SearchQuery = {}): Promise<SearchResult> {
    const { type, q, page, limit } = SearchQuery.parse(query);
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const all = [...(await this._load()).values()]
      .map(({ item }): RegistrySummary => ({
        name: item.name,
        type: item.type,
        version: item.version,
        description: item.description,
        author: item.author,
        downloads: item.downloads,
        updatedAt: item.updatedAt,
      }))
      .filter(
        (item) =>
          (!type || item.type === type) &&
          words.every((word) => `${item.name} ${item.description}`.toLowerCase().includes(word)),
      )
      .sort((a, b) => b.downloads - a.downloads || a.name.localeCompare(b.name));
    return { items: all.slice((page - 1) * limit, page * limit), total: all.length };
  }

  async get(name: string): Promise<RegistryItem> {
    const entry = (await this._load()).get(name);
    if (!entry) throw new RegistryError('NOT_FOUND', `${name} was not found`);
    return entry.item;
  }

  async download(name: string, version: string): Promise<Uint8Array> {
    const folder = (await this._load()).get(name)?.folders.get(version);
    if (!folder) throw new RegistryError('NOT_FOUND', `${name}@${version} was not found`);
    return this._archive(folder);
  }

  private _archive(folder: string): Promise<Uint8Array> {
    let archive = this._archives.get(folder);
    if (!archive) this._archives.set(folder, (archive = zipFolder(folder)));
    return archive;
  }

  private async _load(): Promise<Map<string, Entry>> {
    const listing = await this._listing();
    if (!this._entries || listing !== this._listed) {
      this._listed = listing;
      this._entries = this._read();
    }
    return this._entries;
  }

  /** The version folders there are, as one string to compare. */
  private async _listing(): Promise<string> {
    const names = (dir: string) =>
      readdir(dir, { withFileTypes: true }).then(
        (entries) => entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
        () => [] as string[],
      );
    const found: string[] = [];
    for (const scope of await names(this.dir)) {
      for (const name of await names(join(this.dir, scope))) {
        for (const version of await names(join(this.dir, scope, name)))
          found.push(`${scope}/${name}/${version}`);
      }
    }
    return found.sort().join('\n');
  }

  private async _read(): Promise<Map<string, Entry>> {
    const entries = new Map<string, Entry>();
    if (!existsSync(this.dir)) return entries;
    const folders = async (dir: string) =>
      (await readdir(dir, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    for (const scope of (await folders(this.dir)).filter((name) => name.startsWith('@'))) {
      for (const short of await folders(join(this.dir, scope))) {
        const name = `${scope}/${short}`;
        if (!ItemName.safeParse(name).success) continue;
        const root = join(this.dir, scope, short);
        const versions: (RegistryVersion & { manifest: ItemManifest; folder: string })[] = [];
        for (const version of await folders(root)) {
          const folder = join(root, version);
          const manifest = ItemManifest.safeParse(
            await readFile(join(folder, MANIFEST_FILE), 'utf8')
              .then((text) => JSON.parse(text) as unknown)
              .catch(() => undefined),
          );
          if (!manifest.success || manifest.data.name !== name || manifest.data.version !== version)
            continue;
          versions.push({
            version,
            publishedAt: (await stat(join(folder, MANIFEST_FILE))).mtime.toISOString(),
            sha256: sha256(await this._archive(folder)),
            dependencies: manifest.data.dependencies ?? {},
            engines: manifest.data.engines ?? {},
            manifest: manifest.data,
            folder,
          });
        }
        if (!versions.length) continue;
        versions.sort((a, b) => semver.rcompare(a.version, b.version));
        const latest = versions[0]!;
        const extra = (await readFile(join(root, 'registry.json'), 'utf8')
          .then((text) => JSON.parse(text) as unknown)
          .catch(() => ({}))) as { author?: string; downloads?: number };
        entries.set(name, {
          item: {
            name,
            type: latest.manifest.type,
            version: latest.version,
            description: latest.manifest.description ?? '',
            author: extra.author ?? '',
            downloads: extra.downloads ?? 0,
            updatedAt: latest.publishedAt,
            readme: await readFile(join(latest.folder, 'README.md'), 'utf8').catch(() => ''),
            versions: versions.map((entry) => ({
              version: entry.version,
              publishedAt: entry.publishedAt,
              sha256: entry.sha256,
              dependencies: entry.dependencies,
              engines: entry.engines,
            })),
          },
          folders: new Map(versions.map((version) => [version.version, version.folder])),
        });
      }
    }
    return entries;
  }
}
