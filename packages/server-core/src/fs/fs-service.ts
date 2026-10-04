import ignore, { type Ignore } from 'ignore';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import type { FileContent, FileEntry } from '@nanoforge-dev/editor-protocol';
import { RpcError } from '@nanoforge-dev/editor-rpc';

import { sha1 } from '../util/hash';
import { KeyedMutex } from '../util/keyed-mutex';
import { PathJail } from './path-jail';

export const EDITOR_DIR = '.nanoforge/editor';
export const TRASH_DIR = `${EDITOR_DIR}/trash`;
/** Hides files from the whole editor (gitignore syntax); optional. */
export const NFIGNORE_FILE = '.nfignore';
/** Installed bundles: usable, never modified (copy an entry into the project to change it). */
export const PACKAGES_DIR = 'nf_modules';
const EDITOR_GITIGNORE = 'trash/\nlocal.json\n';

const MAX_READ_BYTES = 64 * 1024 * 1024;

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

const assertWritable = (path: string) => {
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
  private _ignore: { mtime: number; rules: Ignore } | undefined;

  constructor(readonly root: string) {
    this.jail = new PathJail(root);
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
    const absolute = await this.jail.resolve(path);
    try {
      const info = await stat(absolute);
      return {
        path,
        kind: info.isDirectory() ? 'directory' : 'file',
        size: info.size,
        mtime: info.mtimeMs,
      };
    } catch (error) {
      if (errno(error) === 'ENOENT') return null;
      return mapError(error, path);
    }
  }

  async list(path: string, recursive = false): Promise<FileEntry[]> {
    const absolute = await this.jail.resolve(path);
    await this.refreshIgnore();
    const entries: FileEntry[] = [];
    const walk = async (dir: string, rel: string) => {
      let names;
      try {
        names = await readdir(dir, { withFileTypes: true });
      } catch (error) {
        return mapError(error, rel);
      }
      for (const entry of names.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.isSymbolicLink()) continue; // never follow links while listing
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        const info = await stat(join(dir, entry.name)).catch(() => undefined);
        if (!info) continue;
        const kind = info.isDirectory() ? 'directory' : 'file';
        if (this.isIgnored(childRel, kind === 'directory')) continue;
        entries.push({ path: childRel, kind, size: info.size, mtime: info.mtimeMs });
        if (recursive && kind === 'directory' && !SKIPPED_IN_RECURSIVE_LIST.has(entry.name)) {
          await walk(join(dir, entry.name), childRel);
        }
      }
    };
    await walk(absolute, path);
    return entries;
  }

  async read(path: string): Promise<FileContent> {
    const absolute = await this.jail.resolve(path);
    try {
      const info = await stat(absolute);
      if (info.isDirectory()) throw new RpcError('BAD_REQUEST', `Is a directory: ${path}`);
      if (info.size > MAX_READ_BYTES)
        throw new RpcError('PAYLOAD_TOO_LARGE', `File too large: ${path}`);
      const content = new Uint8Array(await readFile(absolute));
      return {
        path,
        kind: 'file',
        size: info.size,
        mtime: info.mtimeMs,
        content,
        hash: sha1(content),
      };
    } catch (error) {
      if (error instanceof RpcError) throw error;
      return mapError(error, path);
    }
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
      return { path, kind: 'file', size: info.size, mtime: info.mtimeMs, hash: sha1(content) };
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

  private async _ensureEditorGitignore(): Promise<void> {
    const file = await this.jail.resolve(`${EDITOR_DIR}/.gitignore`);
    if (!existsSync(file)) await writeFile(file, EDITOR_GITIGNORE);
  }
}

/** Heavy folders a recursive listing does not descend into. */
const SKIPPED_IN_RECURSIVE_LIST = new Set(['node_modules', '.git']);
