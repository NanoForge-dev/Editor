export class FileSystemHandler {
  private fs!: FileSystemDirectoryHandle;
  private readonly rootPath: string;

  constructor(root: string) {
    this.rootPath = root;
  }

  async getDirectory(path?: string, create?: boolean): Promise<FileSystemDirectoryHandle> {
    await this._checkRootHandle();
    if (!path) return this.fs;
    return this._getSubDirFromRawPath(this.fs, path, create);
  }

  async getFile(path: string, create = true): Promise<FileSystemFileHandle> {
    await this._checkRootHandle();
    const paths = this._parsePath(path);
    const fileName = paths.pop();
    if (!fileName) {
      throw new Error();
    }
    const handle = await this._getSubDirFromPath(this.fs, paths, create);
    return handle.getFileHandle(fileName, { create });
  }

  private async _checkRootHandle(): Promise<void> {
    if (!this.fs) await this._initRootHandle();
  }

  private async _initRootHandle() {
    const rootHandle = await navigator.storage.getDirectory();
    this.fs = await this._getSubDirFromRawPath(rootHandle, this.rootPath);
  }

  private async _getSubDirFromRawPath(
    handle: FileSystemDirectoryHandle,
    rawPath: string,
    create?: boolean,
  ): Promise<FileSystemDirectoryHandle> {
    const path = this._parsePath(rawPath);
    return this._getSubDirFromPath(handle, path, create);
  }

  private async _getSubDirFromPath(
    handle: FileSystemDirectoryHandle,
    path: string[],
    create?: boolean,
  ): Promise<FileSystemDirectoryHandle> {
    for (const dir of path) {
      handle = await this._getSubDir(handle, dir, create);
    }
    return handle;
  }

  private async _getSubDir(
    handle: FileSystemDirectoryHandle,
    name: string,
    create = true,
  ): Promise<FileSystemDirectoryHandle> {
    return handle.getDirectoryHandle(name, { create });
  }

  private _parsePath(path: string): string[] {
    return path.split('/').filter((path: string) => !!path);
  }
}
