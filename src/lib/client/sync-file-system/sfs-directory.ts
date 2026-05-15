import { type SyncFileSystem } from '$lib/client/sync-file-system/sfs';

import { type FileSystemDirectory } from '@utils-client/file-system';

import { SfsFile } from './sfs-file';

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
}
