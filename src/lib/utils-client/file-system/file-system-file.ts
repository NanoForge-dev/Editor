export class FileSystemFile {
  readonly handle: FileSystemFileHandle;

  constructor(handle: FileSystemFileHandle) {
    this.handle = handle;
  }

  getFile(): Promise<File> {
    return this.handle.getFile();
  }

  async read(): Promise<string> {
    const file = await this.handle.getFile();
    return file.text();
  }

  async readJson<T = any>(): Promise<T> {
    const raw = await this.read();
    return JSON.parse(raw) as T;
  }

  async write(text: string): Promise<void> {
    const writable = await this.handle.createWritable();
    await writable.write(text);
    await writable.close();
  }

  async writeJson(content: any): Promise<void> {
    const raw = JSON.stringify(content);
    return this.write(raw);
  }
}
