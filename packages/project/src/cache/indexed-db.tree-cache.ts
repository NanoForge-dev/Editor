import type { FileEntry } from '@nanoforge-dev/editor-protocol';

import { TREES, isCacheDbSupported, projectKey, transact } from './cache-db';
import type { TreeCache } from './cache.type';

/** IndexedDB tree cache (one record per user and project). Failures degrade to misses. */
export class IndexedDbTreeCache implements TreeCache {
  private readonly _key: string;

  static isSupported(): boolean {
    return isCacheDbSupported();
  }

  constructor(user: string, projectId: string) {
    this._key = projectKey(user, projectId);
  }

  async load(): Promise<FileEntry[] | undefined> {
    try {
      return await transact<FileEntry[] | undefined>(TREES, 'readonly', (transaction) =>
        transaction.objectStore(TREES).get(this._key),
      );
    } catch {
      return undefined;
    }
  }

  async save(entries: readonly FileEntry[]): Promise<void> {
    try {
      await transact(TREES, 'readwrite', (transaction) =>
        transaction.objectStore(TREES).put(entries, this._key),
      );
    } catch {}
  }
}
