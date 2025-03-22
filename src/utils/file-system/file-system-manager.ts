import { FileSystemDirectory } from './file-system-directory';
import { FileSystemFile } from './file-system-file';
import { FileSystemHandler } from './file-system-handler';

export class FileSystemManager {
  private readonly fs: FileSystemHandler;

  constructor(root: string) {
    this.fs = new FileSystemHandler(root);
  }

  async getFile(path: string): Promise<FileSystemFile> {
    return new FileSystemFile(await this.fs.getFile(path));
  }

  async getDirectory(path?: string): Promise<FileSystemDirectory> {
    return new FileSystemDirectory(await this.fs.getDirectory(path));
  }
}
