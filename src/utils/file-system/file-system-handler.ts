export class FileSystemHandler {
  private fs!: FileSystemDirectoryHandle;
  private readonly rootPath: string;

  constructor(root: string) {
    this.rootPath = root;
  }

  async getDirectory(path?: string): Promise<FileSystemDirectoryHandle> {
    await this._checkRootHandle();
    if (!path) return this.fs;
    return this._getSubDirFromRawPath(this.fs, path);
  }

  async getFile(path: string): Promise<FileSystemFileHandle> {
    await this._checkRootHandle();
    const paths = this._parsePath(path);
    const fileName = paths.pop();
    if (!fileName) {
      throw new Error();
    }
    const handle = await this._getSubDirFromPath(this.fs, paths);
    return handle.getFileHandle(fileName, { create: true });
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
  ): Promise<FileSystemDirectoryHandle> {
    const path = this._parsePath(rawPath);
    return this._getSubDirFromPath(handle, path);
  }

  private async _getSubDirFromPath(
    handle: FileSystemDirectoryHandle,
    path: string[],
  ): Promise<FileSystemDirectoryHandle> {
    for (const dir of path) {
      handle = await this._getSubDir(handle, dir);
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
