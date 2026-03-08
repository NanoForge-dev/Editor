import { FileSystemDirectory } from './file-system-directory';
import { FileSystemFile } from './file-system-file';
import { FileSystemHandler } from './file-system-handler';

export class FileSystemManager {
  private readonly fs: FileSystemHandler;

  constructor(root: string) {
    this.fs = new FileSystemHandler(root);
  }

  async getFile(path: string, create?: boolean): Promise<FileSystemFile> {
    return new FileSystemFile(await this.fs.getFile(path, create));
  }

  async getDirectory(path?: string, create?: boolean): Promise<FileSystemDirectory> {
    return new FileSystemDirectory(await this.fs.getDirectory(path, create));
  }

  async fileExist(path: string): Promise<boolean> {
    try {
      await this.getFile(path, false);
      return true;
    } catch {
      return false;
    }
  }

  async directoryExist(path: string): Promise<boolean> {
    try {
      await this.getDirectory(path, false);
      return true;
    } catch {
      return false;
    }
  }
}
