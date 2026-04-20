export class FileSystemFile {
  readonly handle: FileSystemFileHandle;

  constructor(handle: FileSystemFileHandle) {
    this.handle = handle;
  }

  getName(): string {
    return this.handle.name;
  }

  getFile(): Promise<File> {
    return this.handle.getFile();
  }

  async isSameFile(file: FileSystemFile): Promise<boolean> {
    return await this.handle.isSameEntry(file.handle);
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

  async writeBinary(base64: string): Promise<void> {
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const writable = await this.handle.createWritable();
    await writable.write(binary);
    await writable.close();
  }

  async writeJson(content: any): Promise<void> {
    const raw = JSON.stringify(content);
    return this.write(raw);
  }

  async getUrl(fileType: string): Promise<string> {
    const file = await this.handle.getFile();
    const blob = new Blob([await file.arrayBuffer()], { type: fileType });
    return URL.createObjectURL(blob);
  }
}
