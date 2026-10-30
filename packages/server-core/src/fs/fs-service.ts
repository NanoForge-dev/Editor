import ignore, { type Ignore } from 'ignore';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import type {
  FileContent,
  FileEntry,
  ReadRequest,
  ReadResult,
} from '@nanoforge-dev/editor-protocol';
import { RpcError } from '@nanoforge-dev/editor-rpc';

import { sha1 } from '../util/hash';
import { KeyedMutex } from '../util/keyed-mutex';
import { FileHashes, type FileVersion } from './file-hashes';
import { PathJail } from './path-jail';

export const EDITOR_DIR = '.nanoforge/editor';
export const TRASH_DIR = `${EDITOR_DIR}/trash`;
/** Hides files from the whole editor (gitignore syntax); optional. */
export const NFIGNORE_FILE = '.nfignore';
/** Installed bundles: usable, never modified (copy an entry into the project to change it). */
export const PACKAGES_DIR = 'nf_modules';
const EDITOR_GITIGNORE = 'trash/\nlocal.json\n';

export const MAX_READ_BYTES = 64 * 1024 * 1024;
/** Bytes `readMany` sends in one answer (a file larger than this still goes, alone). */
const MAX_BATCH_BYTES = 8 * 1024 * 1024;

const notFound = (path: string) => new RpcError('NOT_FOUND', `No such file or directory: ${path}`);

const errno = (error: unknown) => (error as NodeJS.ErrnoException).code;

const mapError = (error: unknown, path: string): never => {
  switch (errno(error)) {
    case 'ENOENT':
      throw notFound(path);
    case 'EEXIST':
    case 'ENOTEMPTY':
    case 'ERR_FS_CP_EEXIST':
      throw new RpcError('CONFLICT', `Already exists: ${path}`);
    case 'EISDIR':
    case 'ENOTDIR':
      throw new RpcError('BAD_REQUEST', `Wrong entry kind: ${path}`);
    case 'EACCES':
    case 'EPERM':
      throw new RpcError('FORBIDDEN', `Permission denied: ${path}`);
    default:
      throw error;
  }
};

/**
 * A repository's own folder is never reached through the file API: writing hooks or config there
 * runs code on the next git command, and its config may hold credentials.
 */
const isGitPath = (path: string) =>
  path.split(/[\\/]/).some((part) => part.toLowerCase() === '.git');

const gitReason = (path: string) =>
  isGitPath(path) ? `${path} is inside a .git folder` : undefined;

const assertAccessible = (path: string) => {
  const refused = gitReason(path);
  if (refused) throw new RpcError('FORBIDDEN', refused);
};

const assertWritable = (path: string) => {
  assertAccessible(path);
  if (path === PACKAGES_DIR || path.startsWith(`${PACKAGES_DIR}/`)) {
    throw new RpcError(
      'FORBIDDEN',
      `${path} is part of an installed package (nf_modules), which cannot be changed. Copy it into your project to modify it.`,
    );
  }
};

/** File operations of one project, jailed to its root. */
export class ProjectFileSystem {
  readonly jail: PathJail;
  private readonly _writes = new KeyedMutex();
  private readonly _hashes: FileHashes;
  private _ignore: { mtime: number; rules: Ignore } | undefined;

  constructor(
    readonly root: string,
    /** Hashes shared by the server's projects (kept between runs); its own otherwise. */
    hashes?: FileHashes,
  ) {
    this._hashes = hashes ?? new FileHashes({ maxBytes: MAX_READ_BYTES });
    this.jail = new PathJail(root, gitReason);
  }

  /** Whether `.nfignore` hides a path (directories are tested with and without a trailing /). */
  isIgnored(path: string, directory?: boolean): boolean {
    const rules = this._ignore?.rules;
    if (!rules || !path || path === NFIGNORE_FILE) return false;
    if (directory !== false && rules.ignores(`${path}/`)) return true;
    return directory !== true && rules.ignores(path);
  }

  /** Reloads `.nfignore` when it changed (called before listings and by the watcher). */
  async refreshIgnore(): Promise<void> {
    const file = join(this.root, NFIGNORE_FILE);
    const info = await stat(file).catch(() => undefined);
    if (!info) {
      this._ignore = undefined;
      return;
    }
    if (this._ignore?.mtime === info.mtimeMs) return;
    const text = await readFile(file, 'utf8').catch(() => '');
    this._ignore = { mtime: info.mtimeMs, rules: ignore().add(text) };
  }

  async stat(path: string): Promise<FileEntry | null> {
    assertAccessible(path);
    const absolute = await this.jail.resolve(path);
    try {
      const info = await stat(absolute);
      const kind = info.isDirectory() ? 'directory' : 'file';
      const hash = kind === 'file' ? await this._hashes.of(absolute, info) : undefined;
      return { path, kind, size: info.size, mtime: info.mtimeMs, ...(hash && { hash }) };
    } catch (error) {
      if (errno(error) === 'ENOENT') return null;
      return mapError(error, path);
    }
  }

  async list(path: string, recursive = false): Promise<FileEntry[]> {
    assertAccessible(path);
    const absolute = await this.jail.resolve(path);
    await this.refreshIgnore();
    const entries: FileEntry[] = [];
    /** Files to hash once the walk is done, a few at a time. */
    const files: { index: number; absolute: string; info: FileVersion }[] = [];
    const walk = async (dir: string, rel: string) => {
      let names;
      try {
        names = await readdir(dir, { withFileTypes: true });
      } catch (error) {
        return mapError(error, rel);
      }
      for (const entry of names.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.isSymbolicLink() || isGitPath(entry.name)) continue;
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        const info = await stat(join(dir, entry.name)).catch(() => undefined);
        if (!info) continue;
        const kind = info.isDirectory() ? 'directory' : 'file';
        if (this.isIgnored(childRel, kind === 'directory')) continue;
        if (kind === 'file')
          files.push({ index: entries.length, absolute: join(dir, entry.name), info });
        entries.push({ path: childRel, kind, size: info.size, mtime: info.mtimeMs });
        if (recursive && kind === 'directory' && !SKIPPED_IN_RECURSIVE_LIST.has(entry.name)) {
          await walk(join(dir, entry.name), childRel);
        }
      }
    };
    await walk(absolute, path);
    const queue = [...files];
    const hashNext = async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        const hash = await this._hashes.of(file.absolute, file.info).catch(() => undefined);
        if (hash) entries[file.index] = { ...entries[file.index]!, hash };
      }
    };
    await Promise.all(Array.from({ length: Math.min(8, queue.length) }, hashNext));
    return entries;
  }

  async read(path: string): Promise<FileContent> {
    assertAccessible(path);
    const absolute = await this.jail.resolve(path);
    try {
      const info = await stat(absolute);
      if (info.isDirectory()) throw new RpcError('BAD_REQUEST', `Is a directory: ${path}`);
      if (info.size > MAX_READ_BYTES)
        throw new RpcError('PAYLOAD_TOO_LARGE', `File too large: ${path}`);
      const content = new Uint8Array(await readFile(absolute));
      const hash = sha1(content);
      this._hashes.remember(absolute, info, hash);
      return { path, kind: 'file', size: info.size, mtime: info.mtimeMs, content, hash };
    } catch (error) {
      if (error instanceof RpcError) throw error;
      return mapError(error, path);
    }
  }

  /**
   * Several files at once: a file whose `knownHash` is current comes back `notModified`, without
   * its bytes. Answers stop past {@link MAX_BATCH_BYTES}; `rest` holds the paths not read yet.
   */
  async readMany(files: readonly ReadRequest[]): Promise<{ files: ReadResult[]; rest: string[] }> {
    const results: ReadResult[] = [];
    let bytes = 0;
    /** Eight files at a time, as separate reads would run; sizes are known before reading. */
    for (let start = 0; start < files.length;) {
      const window = files.slice(start, start + 8);
      const sizes = await Promise.all(
        window.map(async (file) => {
          try {
            return (await stat(await this.jail.resolve(file.path))).size;
          } catch {
            return 0;
          }
        }),
      );
      let take = 0;
      for (const size of sizes) {
        /** A file that would cross the cap waits for the next answer, unless it comes alone. */
        if (bytes + size > MAX_BATCH_BYTES && (results.length || take)) break;
        bytes += size;
        take++;
      }
      const batch = await Promise.all(window.slice(0, take).map((file) => this._readOne(file)));
      results.push(...batch);
      start += take;
      if (take < window.length)
        return { files: results, rest: files.slice(start).map((rest) => rest.path) };
    }
    return { files: results, rest: [] };
  }

  /**
   * Atomic write (temp file + rename). With `expectedHash`, fails with CONFLICT when the file
   * changed since it was read (`null` means "must not exist").
   */
  async write(
    path: string,
    content: Uint8Array | string,
    options: { expectedHash?: string | null; createParents?: boolean } = {},
  ): Promise<FileEntry & { hash: string }> {
    if (path === '') throw new RpcError('BAD_REQUEST', 'Cannot write the project root');
    assertWritable(path);
    const absolute = await this.jail.resolve(path);
    return this._writes.run(absolute, async () => {
      if (options.expectedHash !== undefined) {
        const current = await readFile(absolute).then(
          (buffer) => sha1(buffer),
          (error: unknown) => (errno(error) === 'ENOENT' ? null : mapError(error, path)),
        );
        if (current !== options.expectedHash) {
          throw new RpcError('CONFLICT', `File changed on disk: ${path}`, { hash: current });
        }
      }
      if (options.createParents !== false) await mkdir(dirname(absolute), { recursive: true });
      const temp = join(
        dirname(absolute),
        `.${basename(absolute)}.nf-${randomBytes(4).toString('hex')}`,
      );
      try {
        await writeFile(temp, content);
        await rename(temp, absolute);
      } catch (error) {
        await rm(temp, { force: true });
        return mapError(error, path);
      }
      const info = await stat(absolute);
      const hash = sha1(content);
      this._hashes.remember(absolute, info, hash);
      return { path, kind: 'file', size: info.size, mtime: info.mtimeMs, hash };
    });
  }

  async mkdir(path: string): Promise<FileEntry> {
    assertWritable(path);
    const absolute = await this.jail.resolve(path);
    await mkdir(absolute, { recursive: true }).catch((error: unknown) => mapError(error, path));
    return (await this.stat(path))!;
  }

  async rename(from: string, to: string, overwrite = false): Promise<FileEntry> {
    assertWritable(from);
    assertWritable(to);
    const source = await this.jail.resolve(from);
    const target = await this.jail.resolve(to);
    if (!existsSync(source)) throw notFound(from);
    if (!overwrite && existsSync(target)) throw new RpcError('CONFLICT', `Already exists: ${to}`);
    await mkdir(dirname(target), { recursive: true });
    await rename(source, target).catch((error: unknown) => mapError(error, from));
    return (await this.stat(to))!;
  }

  async copy(from: string, to: string, overwrite = false): Promise<FileEntry> {
    assertAccessible(from);
    assertWritable(to);
    const source = await this.jail.resolve(from);
    const target = await this.jail.resolve(to);
    if (!existsSync(source)) throw notFound(from);
    await cp(source, target, { recursive: true, force: overwrite, errorOnExist: !overwrite }).catch(
      (error: unknown) => mapError(error, from),
    );
    return (await this.stat(to))!;
  }

  /**
   * Moves the entry into the project trash (recoverable), never deletes directly. Returns its
   * place in the trash, for `restore`.
   */
  async delete(path: string): Promise<{ trashPath: string }> {
    if (path === '' || path === TRASH_DIR || path.startsWith(`${TRASH_DIR}/`)) {
      throw new RpcError('BAD_REQUEST', `Cannot delete ${path || 'the project root'}`);
    }
    assertWritable(path);
    const source = await this.jail.resolve(path);
    if (!existsSync(source)) throw notFound(path);
    const trash = await this.jail.resolve(TRASH_DIR);
    await mkdir(trash, { recursive: true });
    await this._ensureEditorGitignore();
    const target = join(
      trash,
      `${Date.now()}-${randomBytes(3).toString('hex')}-${basename(source)}`,
    );
    await rename(source, target).catch((error: unknown) => mapError(error, path));
    return { trashPath: `${TRASH_DIR}/${basename(target)}` };
  }

  /** Brings a deleted entry back from the trash (undo of `delete`). */
  async restore(trashPath: string, to: string): Promise<FileEntry> {
    if (
      !trashPath.startsWith(`${TRASH_DIR}/`) ||
      trashPath.slice(TRASH_DIR.length + 1).includes('/')
    ) {
      throw new RpcError('BAD_REQUEST', `Not in the trash: ${trashPath}`);
    }
    assertWritable(to);
    const source = await this.jail.resolve(trashPath);
    const target = await this.jail.resolve(to);
    if (!existsSync(source)) throw notFound(trashPath);
    if (existsSync(target)) throw new RpcError('CONFLICT', `Already exists: ${to}`);
    await mkdir(dirname(target), { recursive: true });
    await rename(source, target).catch((error: unknown) => mapError(error, to));
    return (await this.stat(to))!;
  }

  private async _readOne(file: ReadRequest): Promise<ReadResult> {
    try {
      const entry = file.knownHash ? await this.stat(file.path) : undefined;
      if (entry === null) throw notFound(file.path);
      if (entry?.hash && entry.hash === file.knownHash)
        return { ...entry, hash: entry.hash, notModified: true };
      return await this.read(file.path);
    } catch (error) {
      return {
        path: file.path,
        error: {
          code: error instanceof RpcError ? error.code : 'INTERNAL',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private async _ensureEditorGitignore(): Promise<void> {
    const file = await this.jail.resolve(`${EDITOR_DIR}/.gitignore`);
    if (!existsSync(file)) await writeFile(file, EDITOR_GITIGNORE);
  }
}

/** Heavy folders a recursive listing does not descend into. */
const SKIPPED_IN_RECURSIVE_LIST = new Set(['node_modules']);
