import type { FileEntry } from '@nanoforge-dev/editor-protocol';

import type { TreeCache } from './cache.type';

export class MemoryTreeCache implements TreeCache {
  private _entries: FileEntry[] | undefined;

  load() {
    return Promise.resolve(this._entries);
  }

  save(entries: readonly FileEntry[]) {
    this._entries = [...entries];
    return Promise.resolve();
  }
}
