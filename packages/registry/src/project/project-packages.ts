import { existsSync } from 'node:fs';
import { readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import semver from 'semver';

import { installItem } from '../install/install-item';
import { ItemName, MANIFEST_FILE, type RegistryItem } from '../item/item.schema';
import { RegistryError } from '../registry/registry.exception';
import type { Registry } from '../registry/registry.type';
import { withPathsEntry, withoutPathsEntry } from '../tsconfig-paths';
import { type Lock, PackagesList, PackagesLock } from './packages-file.schema';
import { LOCK_FILE, MODULES_DIR, PACKAGES_FILE } from './project-packages.const';
import type { InstalledPackage, OutdatedPackage } from './project-packages.type';

const queues = new Map<string, Promise<unknown>>();

/**
 * The packages of a project: its list (`nanoforge.packages.json`), its lock, and the folders in
 * `nf_modules`. One version of a package per project; dependencies are installed side by side.
 * Changes of the same project run one after the other.
 */
export class ProjectPackages {
  constructor(
    readonly root: string,
    private readonly _registry: Registry,
  ) {}

  async list(): Promise<InstalledPackage[]> {
    const [wanted, lock] = await Promise.all([this._readList(), this._readLock()]);
    return Object.entries(lock)
      .map(([name, entry]) => ({
        name,
        version: entry.version,
        ...(wanted[name] !== undefined && { range: wanted[name] }),
        dependents: Object.entries(lock)
          .filter(([, other]) => name in other.dependencies)
          .map(([other]) => other)
          .sort(),
        present: existsSync(join(this._folder(name), MANIFEST_FILE)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The installed packages with the newer versions the registry has. */
  async outdated(): Promise<OutdatedPackage[]> {
    const lock = await this._readLock();
    return Promise.all(
      (await this.list()).map(async (installed): Promise<OutdatedPackage> => {
        const item = await this._registry.get(installed.name).catch((error: unknown) => {
          if (error instanceof RegistryError && error.code === 'NOT_FOUND') return undefined;
          throw error;
        });
        if (!item) return installed;
        const ranges = [
          ...(installed.range !== undefined ? [installed.range] : []),
          ...installed.dependents.map((other) => lock[other]!.dependencies[installed.name]!),
        ];
        const wanted = item.versions
          .map((entry) => entry.version)
          .filter((version) => ranges.every((range) => semver.satisfies(version, range)))
          .sort(semver.rcompare)[0];
        const newer = (version: string | undefined) =>
          version && semver.gt(version, installed.version) ? version : undefined;
        return {
          ...installed,
          ...(newer(wanted) && { wanted: newer(wanted)! }),
          ...(newer(item.version) && { latest: newer(item.version)! }),
        };
      }),
    );
  }

  /** Adds a package to the project (`^<newest>` without a range) and installs what it needs. */
  install(name: string, range?: string): Promise<InstalledPackage[]> {
    return this._queue(async () => {
      this._checkName(name);
      const item = await this._registry.get(name);
      if (item.type !== 'package')
        throw new RegistryError('INVALID', `${name} is a ${item.type}, not a package`);
      const wanted = await this._readList();
      wanted[name] = range ?? `^${item.version}`;
      await this._apply(wanted, new Set([name]));
      return this.list();
    });
  }

  /**
   * Removes a package of the project. Refused while another installed package needs it;
   * dependencies nobody needs any more go with it.
   */
  uninstall(name: string): Promise<InstalledPackage[]> {
    return this._queue(async () => {
      this._checkName(name);
      const wanted = await this._readList();
      const lock = await this._readLock();
      const dependents = Object.entries(lock)
        .filter(([other, entry]) => other !== name && name in entry.dependencies)
        .map(([other]) => other);
      if (dependents.length) {
        throw new RegistryError(
          'IN_USE',
          `${name} is needed by ${dependents.join(', ')}: uninstall ${dependents.length > 1 ? 'them' : 'it'} first`,
        );
      }
      if (!(name in wanted) && !(name in lock))
        throw new RegistryError('NOT_FOUND', `${name} is not installed`);
      const remaining = Object.fromEntries(
        Object.entries(wanted).filter(([other]) => other !== name),
      );
      await this._apply(remaining, new Set());
      return this.list();
    });
  }

  /** Moves a package to the newest version in its range, or to the newest of all (`latest`). */
  update(name: string, latest = false): Promise<InstalledPackage[]> {
    return this._queue(async () => {
      this._checkName(name);
      const wanted = await this._readList();
      if (latest && name in wanted) {
        const item = await this._registry.get(name);
        wanted[name] = `^${item.version}`;
      }
      await this._apply(wanted, new Set([name]));
      return this.list();
    });
  }

  /** Installs what the lock lists and `nf_modules` lacks (a fresh clone). */
  restore(): Promise<InstalledPackage[]> {
    return this._queue(async () => {
      const lock = await this._readLock();
      for (const [name, entry] of Object.entries(lock)) {
        if (existsSync(join(this._folder(name), MANIFEST_FILE))) continue;
        await installItem(this._registry, {
          name,
          version: entry.version,
          type: 'package',
          target: this._folder(name),
          sha256: entry.sha256,
        });
      }
      await this._syncProjectFiles(lock);
      return this.list();
    });
  }

  private _folder(name: string): string {
    return join(this.root, MODULES_DIR, ...name.split('/'));
  }

  private _checkName(name: string): void {
    if (!ItemName.safeParse(name).success)
      throw new RegistryError('INVALID', `${name} is not a valid package name`);
  }

  private _queue<T>(run: () => Promise<T>): Promise<T> {
    const previous = queues.get(this.root) ?? Promise.resolve();
    const next = previous.then(run, run);
    queues.set(
      this.root,
      next.catch(() => undefined),
    );
    return next;
  }

  /**
   * Resolves the wanted packages and their dependencies to one version each, installs what
   * changed, removes what is no longer needed, and writes the list, the lock and the paths.
   * Installed versions are kept when they still fit, except for the names in `refresh`.
   */
  private async _apply(
    wanted: Record<string, string>,
    refresh: ReadonlySet<string>,
  ): Promise<void> {
    const lock = await this._readLock();
    const items = new Map<string, RegistryItem>();
    const item = async (name: string) => {
      let found = items.get(name);
      if (!found) items.set(name, (found = await this._registry.get(name)));
      return found;
    };

    let picks = new Map<string, string>();
    for (let round = 0; ; round++) {
      if (round > 50)
        throw new RegistryError('CONFLICT', 'The dependencies of these packages never settle');
      const ranges = new Map<string, { range: string; by: string }[]>();
      const ask = (name: string, range: string, by: string) =>
        ranges.set(name, [...(ranges.get(name) ?? []), { range, by }]);
      for (const [name, range] of Object.entries(wanted)) ask(name, range, 'the project');
      for (const [name, version] of picks) {
        const dependencies =
          (await item(name)).versions.find((entry) => entry.version === version)?.dependencies ??
          {};
        for (const [dependency, range] of Object.entries(dependencies))
          ask(dependency, range, `${name}@${version}`);
      }
      const next = new Map<string, string>();
      for (const [name, asked] of ranges) {
        const found = await item(name);
        if (found.type !== 'package')
          throw new RegistryError('INVALID', `${name} is a ${found.type}, not a package`);
        const fits = (version: string) =>
          asked.every(({ range }) => semver.satisfies(version, range));
        const locked = lock[name]?.version;
        const version =
          locked && !refresh.has(name) && fits(locked)
            ? locked
            : found.versions
                .map((entry) => entry.version)
                .filter(fits)
                .sort(semver.rcompare)[0];
        if (!version) {
          throw new RegistryError(
            'CONFLICT',
            `No version of ${name} fits ${asked
              .map(({ range, by }) => `${range} (asked by ${by})`)
              .join(' and ')}`,
          );
        }
        next.set(name, version);
      }
      const settled =
        next.size === picks.size &&
        [...next].every(([name, version]) => picks.get(name) === version);
      picks = next;
      if (settled) break;
    }

    const nextLock: Lock = {};
    for (const [name, version] of [...picks].sort(([a], [b]) => a.localeCompare(b))) {
      const entry = (await item(name)).versions.find((candidate) => candidate.version === version)!;
      const current = lock[name];
      const upToDate =
        current?.version === version &&
        current.sha256 === entry.sha256 &&
        existsSync(join(this._folder(name), MANIFEST_FILE));
      if (!upToDate) {
        await installItem(this._registry, {
          name,
          version,
          type: 'package',
          target: this._folder(name),
          sha256: entry.sha256,
        });
      }
      nextLock[name] = { version, sha256: entry.sha256, dependencies: entry.dependencies };
    }
    for (const name of Object.keys(lock)) {
      if (!picks.has(name)) {
        await rm(this._folder(name), { recursive: true, force: true });
        await rmdir(dirname(this._folder(name)))
          .then(() => rmdir(join(this.root, MODULES_DIR)))
          .catch(() => undefined);
      }
    }

    await this._writeJson(PACKAGES_FILE, {
      ...(await this._readRawList()),
      packages: sorted(wanted),
    });
    await this._writeJson(LOCK_FILE, { lockVersion: 1, packages: nextLock });
    await this._syncProjectFiles(nextLock, Object.keys(lock));
  }

  /** Import paths of the installed packages (root tsconfig). The project's .gitignore is its own. */
  private async _syncProjectFiles(lock: Lock, previous: readonly string[] = []): Promise<void> {
    const tsconfig = join(this.root, 'tsconfig.json');
    const original = await readFile(tsconfig, 'utf8').catch(() => undefined);
    let text = original ?? '{}\n';
    for (const name of previous) {
      if (!(name in lock)) text = withoutPathsEntry(text, `${name}/*`);
    }
    for (const name of Object.keys(lock))
      text = withPathsEntry(text, `${name}/*`, `./${MODULES_DIR}/${name}/*`);
    if (text !== original && (original !== undefined || Object.keys(lock).length))
      await writeFile(tsconfig, text);
  }

  private async _readRawList(): Promise<Record<string, unknown>> {
    const text = await readFile(join(this.root, PACKAGES_FILE), 'utf8').catch(() => undefined);
    if (text === undefined) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new RegistryError('INVALID', `${PACKAGES_FILE} is not valid JSON`);
    }
  }

  private async _readList(): Promise<Record<string, string>> {
    const parsed = PackagesList.safeParse(await this._readRawList());
    if (!parsed.success)
      throw new RegistryError(
        'INVALID',
        `${PACKAGES_FILE} is not valid: ${parsed.error.issues[0]?.message}`,
      );
    return { ...parsed.data.packages };
  }

  private async _readLock(): Promise<Lock> {
    const text = await readFile(join(this.root, LOCK_FILE), 'utf8').catch(() => undefined);
    if (text === undefined) return {};
    const parsed = PackagesLock.safeParse(JSON.parse(text) as unknown);
    if (!parsed.success) throw new RegistryError('INVALID', `${LOCK_FILE} is not valid`);
    return parsed.data.packages;
  }

  private _writeJson(file: string, value: unknown): Promise<void> {
    return writeFile(join(this.root, file), `${JSON.stringify(value, null, 2)}\n`);
  }
}

const sorted = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
