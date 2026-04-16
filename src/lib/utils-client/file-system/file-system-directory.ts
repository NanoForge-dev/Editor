import { FileSystemFile } from './file-system-file';

export type FileSystemChild = [string, FileSystemDirectory | FileSystemFile];
export type FileSystemDirectoryChild = [string, FileSystemDirectory];
export type FileSystemFileChild = [string, FileSystemFile];

export class FileSystemDirectory {
  readonly handle: FileSystemDirectoryHandle;

  constructor(handle: FileSystemDirectoryHandle) {
    this.handle = handle;
  }

  getName(): string {
    return this.handle.name;
  }

  async getFile(name: string, create = true): Promise<FileSystemFile> {
    return new FileSystemFile(await this.handle.getFileHandle(name, { create }));
  }

  async getDirectory(name: string, create = true): Promise<FileSystemDirectory> {
    return new FileSystemDirectory(await this.handle.getDirectoryHandle(name, { create }));
  }

  async getChildren(): Promise<FileSystemChild[]> {
    const result: FileSystemChild[] = [];
    const entries = this.handle.entries();

    for await (const [name, handle] of entries) {
      const newHandle =
        handle instanceof FileSystemDirectoryHandle
          ? new FileSystemDirectory(handle)
          : new FileSystemFile(handle);
      result.push([name, newHandle]);
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
