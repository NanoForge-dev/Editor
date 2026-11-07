import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { KeyedMutex } from '../util/keyed-mutex';

interface TrustFile {
  /** Real paths of the folders whose code the local editor may run. */
  readonly folders: string[];
}

/**
 * The folders a local editor trusts: opening one runs its `nanoforge.config.ts`, its plugins'
 * server entries, its builds and games, its Prettier and its git hooks. Kept in the editor's
 * data folder (per OS user), by real path, so a link cannot stand in for a trusted folder.
 */
export class TrustStore {
  private readonly _lock = new KeyedMutex();
  private _folders: Set<string> | undefined;

  constructor(
    private readonly _dataDir: string,
    /**
     * Folders trusted when the store is first created: those opened before trust existed, under a
     * prompt that already said their code would run.
     */
    private readonly _initial: () => Promise<readonly string[]>,
  ) {}

  async isTrusted(realPath: string): Promise<boolean> {
    return (await this._load()).has(realPath);
  }

  trust(realPath: string): Promise<void> {
    return this._lock.run('trust', async () => {
      const folders = await this._load();
      if (folders.has(realPath)) return;
      folders.add(realPath);
      await this._write(folders);
    });
  }

  private get _file(): string {
    return join(this._dataDir, 'trusted-folders.json');
  }

  private async _load(): Promise<Set<string>> {
    if (this._folders) return this._folders;
    if (!existsSync(this._file)) {
      const folders = new Set(await this._initial());
      await this._write(folders);
      this._folders = folders;
      return folders;
    }
    try {
      const file = JSON.parse(await readFile(this._file, 'utf8')) as Partial<TrustFile>;
      this._folders = new Set(Array.isArray(file.folders) ? file.folders : []);
    } catch {
      this._folders = new Set();
    }
    return this._folders;
  }

  private async _write(folders: ReadonlySet<string>): Promise<void> {
    await mkdir(this._dataDir, { recursive: true });
    const temp = `${this._file}.${randomBytes(4).toString('hex')}.tmp`;
    try {
      await writeFile(temp, `${JSON.stringify({ folders: [...folders].sort() }, null, 2)}\n`);
      await rename(temp, this._file);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }
}
