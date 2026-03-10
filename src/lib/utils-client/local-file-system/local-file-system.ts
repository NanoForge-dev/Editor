import { type FileSystemFile, FileSystemManager } from '../file-system';

export class LocalFileSystem {
  private readonly fs: FileSystemManager;

  constructor(root: string) {
    this.fs = new FileSystemManager(root);
  }

  async askFileAndCache(path: string): Promise<FileSystemFile> {
    // @ts-ignore
    const inHandle = (await window.showOpenFilePicker({ multiple: false })) as FileSystemFileHandle;
    const inFile = await inHandle.getFile();
    const handle = await this.fs.getFile(path);
    await handle.write(await inFile.text());
    return handle;
  }

  async saveFileFromCache(name: string = 'project.nfps', path: string): Promise<void> {
    // @ts-ignore
    const outHandle = (await window.showSaveFilePicker({
      suggestedName: name,
    })) as FileSystemFileHandle;
    const outWritable = await outHandle.createWritable();
    const handle = await this.fs.getFile(path);
    await outWritable.write(await handle.read());
  }
}
