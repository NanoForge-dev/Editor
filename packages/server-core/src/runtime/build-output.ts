import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import type { OutputFile } from '@nanoforge-dev/editor-protocol';

import { sha1 } from '../util/hash';

interface CachedHash {
  readonly size: number;
  readonly mtime: number;
  readonly hash: string;
}

/** Lists a build output directory with content hashes (re-hashing only changed files). */
export class BuildOutput {
  private readonly _hashes = new Map<string, CachedHash>();

  /** Hash of every file hash: identifies one build. */
  static version(files: readonly OutputFile[]): string {
    return sha1(files.map((file) => `${file.path}:${file.hash}`).join('\n')).slice(0, 16);
  }

  constructor(readonly dir: string) {}

  async files(): Promise<OutputFile[]> {
    const files: OutputFile[] = [];
    const walk = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const absolute = join(dir, entry.name);
        if (entry.isDirectory()) await walk(absolute);
        else if (entry.isFile()) files.push(await this._file(absolute));
      }
    };
    await walk(this.dir);
    for (const path of this._hashes.keys()) {
      if (!files.some((file) => join(this.dir, file.path) === path)) this._hashes.delete(path);
    }
    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Content hash of a file of the output (cached by size and mtime). */
  async hash(absolute: string): Promise<string | undefined> {
    return (await this._file(absolute).catch(() => undefined))?.hash;
  }

  private async _file(absolute: string): Promise<OutputFile> {
    const info = await stat(absolute);
    const path = relative(this.dir, absolute).split(sep).join('/');
    const cached = this._hashes.get(absolute);
    if (cached && cached.size === info.size && cached.mtime === info.mtimeMs) {
      return { path, size: info.size, hash: cached.hash };
    }
    const hash = sha1(await readFile(absolute));
    this._hashes.set(absolute, { size: info.size, mtime: info.mtimeMs, hash });
    return { path, size: info.size, hash };
  }
}
