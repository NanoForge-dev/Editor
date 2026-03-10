import { FileSystemFile } from './file-system-file';

export class FileSystemDirectory {
  readonly handle: FileSystemDirectoryHandle;

  constructor(handle: FileSystemDirectoryHandle) {
    this.handle = handle;
  }

  async getFile(name: string, create = true): Promise<FileSystemFile> {
    return new FileSystemFile(await this.handle.getFileHandle(name, { create }));
  }

  async getDirectory(name: string, create = true): Promise<FileSystemDirectory> {
    return new FileSystemDirectory(await this.handle.getDirectoryHandle(name, { create }));
  }

  removeChild(name: string, recursive = true): Promise<void> {
    return this.handle.removeEntry(name, { recursive });
  }

  async clear(): Promise<void> {
    for await (const name of this.handle.keys()) {
      await this.removeChild(name);
    }
  }
}
