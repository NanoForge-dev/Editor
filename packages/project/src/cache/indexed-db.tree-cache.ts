import type { FileEntry } from '@nanoforge-dev/editor-protocol';

import type { TreeCache } from './cache.type';

export const DB_NAME = 'nanoforge-editor';
export const STORE = 'trees';

/** IndexedDB tree cache (one record per project). */
export class IndexedDbTreeCache implements TreeCache {
  static isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  constructor(private readonly _projectId: string) {}

  async load(): Promise<FileEntry[] | undefined> {
    try {
      return await this._run<FileEntry[] | undefined>('readonly', (store) =>
        store.get(this._projectId),
      );
    } catch {
      return undefined;
    }
  }

  async save(entries: readonly FileEntry[]): Promise<void> {
    try {
      await this._run('readwrite', (store) => store.put(entries, this._projectId));
    } catch {}
  }

  private async _run<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
    });
    try {
      return await new Promise<T>((resolve, reject) => {
        const request = action(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      });
    } finally {
      db.close();
    }
  }
}
