import type { ContentCache } from './cache.type';

export class MemoryContentCache implements ContentCache {
  private readonly _contents = new Map<string, Uint8Array>();

  get(hash: string) {
    return Promise.resolve(this._contents.get(hash));
  }

  set(hash: string, content: Uint8Array) {
    this._contents.set(hash, content);
    return Promise.resolve();
  }
}
