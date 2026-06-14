import type { SyncFileSystem } from '$lib/client/sync-file-system/sfs';

import { SESSION_PROJECT_HEADER } from '@utils/const';

import type { FileSystemFile } from '@utils-client/file-system';

export class SfsFile {
  private readonly _route: string;

  constructor(
    private readonly _handler: SyncFileSystem,
    private _cache: FileSystemFile | null,
    private readonly _path: string,
  ) {
    this._route = `${this._handler.route}?path=${encodeURIComponent(`${this._path}?url`)}`;
  }

  get path(): string {
    return this._path;
  }

  async getUrl(): Promise<string> {
    await this._preRead();
    return this._cache!.getUrl();
  }

  async read(): Promise<string> {
    await this._preRead();
    return this._cache!.read();
  }

  async readJson(): Promise<string> {
    await this._preRead();
    return this._cache!.readJson();
  }

  async fetch(): Promise<void> {
    await this._preWrite();
    const res = await fetch(this._route, {
      method: 'GET',
      headers: { [SESSION_PROJECT_HEADER]: this._handler.project.id },
    });
    if (!res.ok || !res.body) {
      throw new Error('Failed to fetch file');
    }
    const stream = await this._cache!.handle.createWritable();
    await res.body.pipeTo(stream);
  }

  async write(test: string): Promise<void> {
    await this._preWrite();
    await this._cache!.write(test);
    await this.sync();
  }

  async writeJson(content: any): Promise<void> {
    await this._preWrite();
    await this._cache!.writeJson(content);
    await this.sync();
  }

  async sync(): Promise<void> {
    if (!this._cache) return;
    const file = await this._cache.getFile();
    const res = await fetch(this._route, {
      body: file,
      method: 'POST',
      headers: {
        [SESSION_PROJECT_HEADER]: this._handler.project.id,
        'Content-Type': 'application/octet-stream',
      },
    });
    if (!res.ok) throw new Error(`Failed to sync file: ${await res.text()}`);
  }

  async delete(): Promise<void> {
    const res = await fetch(this._route, {
      method: 'DELETE',
      headers: {
        [SESSION_PROJECT_HEADER]: this._handler.project.id,
      },
    });
    if (!res.ok) throw new Error(`Failed to delete file: ${await res.text()}`);
  }

  async getFile(): Promise<FileSystemFile> {
    await this._preRead();
    return this._cache!;
  }

  private async _preRead() {
    if (!this._cache) {
      await this.fetch();
    }
  }

  private async _preWrite() {
    if (!this._cache) {
      this._cache = await this._handler.cache.getFile(this.path, true);
    }
  }
}
