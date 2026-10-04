import type { CachedContent, ContentCache } from './cache.type';

export class MemoryContentCache implements ContentCache {
  private readonly _entries = new Map<string, CachedContent>();

  get(path: string) {
    return Promise.resolve(this._entries.get(path));
  }

  set(path: string, value: CachedContent) {
    this._entries.set(path, value);
    return Promise.resolve();
  }

  delete(path: string) {
    for (const key of [...this._entries.keys()]) {
      if (key === path || key.startsWith(`${path}/`)) this._entries.delete(key);
    }
    return Promise.resolve();
  }

  clear() {
    this._entries.clear();
    return Promise.resolve();
  }
}
