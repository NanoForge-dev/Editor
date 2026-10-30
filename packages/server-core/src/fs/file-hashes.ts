import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Hashes kept at most; the least recently used are forgotten first. */
const MAX_ENTRIES = 50_000;
/** Saving waits this long after the last new hash. */
const SAVE_DELAY_MS = 2000;

/** What tells a file's versions apart without reading it. */
export interface FileVersion {
  readonly size: number;
  readonly mtimeMs: number;
  /** Changed by every write, and unlike mtime, never set back by a program. */
  readonly ctimeMs: number;
  readonly ino: number;
}

export interface FileHashesOptions {
  /** Files larger than this get no hash (they are never read whole). */
  readonly maxBytes: number;
  /**
   * Where the hashes are kept between runs (`DATA_DIR/file-hashes.json`): without it, the first
   * listing after a start reads every file of the project again.
   */
  readonly file?: string;
}

/**
 * sha1 of files, one per path, valid for one version (size, mtime, ctime, inode): a listing
 * hashes each file once, and again only after it changed. Files are read as streams, so memory
 * stays small whatever their size. Clients compare the hash with the copy they cached.
 *
 * A file written between its stat and the end of its read gets the new content's hash under the
 * old version: the next write changes the version again, and reads hash what they send anyway.
 */
export class FileHashes {
  /** By absolute path, least recently used first. */
  private readonly _hashes = new Map<string, { version: string; hash: string }>();
  private _loaded: Promise<void> | undefined;
  private _saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly _options: FileHashesOptions) {}

  /** The hash of a file, or undefined when it is too large to be read (and cached) at all. */
  async of(absolute: string, info: FileVersion): Promise<string | undefined> {
    if (info.size > this._options.maxBytes) return undefined;
    await this._load();
    const known = this._hashes.get(absolute);
    if (known?.version === versionOf(info)) {
      this._hashes.delete(absolute);
      this._hashes.set(absolute, known);
      return known.hash;
    }
    const hash = await streamSha1(absolute);
    this.remember(absolute, info, hash);
    return hash;
  }

  /** Records a hash computed elsewhere (a read or a write of the file). */
  remember(absolute: string, info: FileVersion, hash: string): void {
    const version = versionOf(info);
    const known = this._hashes.get(absolute);
    this._hashes.delete(absolute);
    this._hashes.set(absolute, { version, hash });
    if (known?.version === version && known.hash === hash) return;
    if (this._hashes.size > MAX_ENTRIES)
      this._hashes.delete(this._hashes.keys().next().value as string);
    this._scheduleSave();
  }

  /** Writes what is waiting to be saved. */
  async flush(): Promise<void> {
    if (!this._saveTimer) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = undefined;
    await this._save();
  }

  private _load(): Promise<void> {
    const file = this._options.file;
    this._loaded ??= file
      ? readFile(file, 'utf8')
          .then((text) => {
            for (const [path, value] of JSON.parse(text) as [string, unknown][]) {
              if (this._hashes.has(path) || !isSaved(value)) continue;
              this._hashes.set(path, { version: value.version, hash: value.hash });
            }
          })
          .catch(() => undefined)
      : Promise.resolve();
    return this._loaded;
  }

  private _scheduleSave(): void {
    if (!this._options.file || this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = undefined;
      void this._save();
    }, SAVE_DELAY_MS);
    this._saveTimer.unref?.();
  }

  private async _save(): Promise<void> {
    const file = this._options.file;
    if (!file) return;
    try {
      await mkdir(dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify([...this._hashes]));
      await rename(temp, file);
    } catch {}
  }
}

const versionOf = (info: FileVersion) =>
  `${info.size}\0${info.mtimeMs}\0${info.ctimeMs}\0${info.ino}`;

/** An entry of the saved file (older files, keyed by version, are dropped). */
const isSaved = (value: unknown): value is { version: string; hash: string } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { version?: unknown }).version === 'string' &&
  typeof (value as { hash?: unknown }).hash === 'string';

const streamSha1 = (absolute: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha1');
    createReadStream(absolute)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
