import { FileSystemFile } from './file-system-file';

export type FileSystemMapChildren = Map<string, FileSystemDirectory | FileSystemFile>;
export type FileSystemMapDirectoryChildren = Map<string, FileSystemDirectory>;

export type FileSystemMapEntry = [string, FileSystemDirectory | FileSystemFile];
export type FileSystemMapEntryDirectory = [string, FileSystemDirectory];

export class FileSystemDirectory {
  readonly handle: FileSystemDirectoryHandle;

  constructor(handle: FileSystemDirectoryHandle) {
    this.handle = handle;
  }

  get name(): string {
    return this.handle.name;
  }

  async getFile(name: string, create = true): Promise<FileSystemFile> {
    return new FileSystemFile(await this.handle.getFileHandle(name, { create }));
  }

  async fileExist(name: string): Promise<boolean> {
    try {
      await this.handle.getFileHandle(name, { create: false });
      return true;
    } catch {
      return false;
    }
  }

  async getDirectory(name: string, create = true): Promise<FileSystemDirectory> {
    return new FileSystemDirectory(await this.handle.getDirectoryHandle(name, { create }));
  }

  async getChildren(): Promise<FileSystemMapChildren> {
    const result: FileSystemMapChildren = new Map();
    const entries = this.handle.entries();

    for await (const [name, handle] of entries) {
      result.set(
        name,
        handle instanceof FileSystemDirectoryHandle
          ? new FileSystemDirectory(handle)
          : new FileSystemFile(handle),
      );
    }
    return result;
  }

  async removeChild(name: string, recursive = true): Promise<void> {
    return this.handle.removeEntry(name, { recursive });
  }

  async getParents(root: FileSystemDirectory): Promise<FileSystemDirectory[] | null> {
    const parentsFolderNames = await root.handle.resolve(this.handle);
    const parents: FileSystemDirectory[] = [];
    let previousParent: FileSystemDirectory = root;

    if (!parentsFolderNames) return null;

    for (const folder of parentsFolderNames) {
      previousParent = await previousParent.getDirectory(folder);
      parents.push(previousParent);
    }
    return parents;
  }

  async clear(): Promise<void> {
    for await (const name of this.handle.keys()) {
      await this.removeChild(name);
    }
  }
}
