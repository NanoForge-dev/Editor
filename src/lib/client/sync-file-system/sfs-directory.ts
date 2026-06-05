import type { SyncFileSystem } from '$lib/client/sync-file-system/sfs';
import type { DirectoryContent } from '$lib/server/file-system/project-directory';

import type { FileSystemDirectory } from '@utils-client/file-system';

import { SfsFile } from './sfs-file';

export type SfsDirectoryMap = DirectoryContent;

export class SfsDirectory {
  constructor(
    private readonly _handler: SyncFileSystem,
    private _cache: FileSystemDirectory,
    private readonly _path: string,
  ) {}

  get path(): string {
    return this._path;
  }

  async getFile(path: string): Promise<SfsFile> {
    const fullPath = `${this._path}/${path}`;
    if (await this._cache.fileExist(path))
      return new SfsFile(this._handler, await this._cache?.getFile(path, false), fullPath);
    return new SfsFile(this._handler, null, fullPath);
  }

  async getDirectory(path: string): Promise<SfsDirectory> {
    const fullPath = `${this._path}/${path}`;
    return new SfsDirectory(this._handler, await this._cache.getDirectory(path, true), fullPath);
  }

  async readdir(noCache: boolean = false): Promise<SfsDirectoryMap> {
    let res: SfsDirectoryMap | null = null;

    if (!noCache && this._handler.treeCache) res = await this._handler.treeCache.read(this._path);

    if (res) return res;

    res = await this._handler.project.actions.fs.readdir({ path: this._path });

    if (this._handler.treeCache) await this._handler.treeCache.write(this._path, res);

    return res;
  }
}
