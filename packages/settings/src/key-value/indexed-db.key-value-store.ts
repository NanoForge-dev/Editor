import type { KeyValueStore } from './key-value-store.type';

const DB_NAME = 'nanoforge-editor-settings';
const STORE = 'kv';

export class IndexedDbKeyValueStore implements KeyValueStore {
  private _db: Promise<IDBDatabase> | undefined;

  static isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  get<T>(key: string): Promise<T | undefined> {
    return this._request<T | undefined>('readonly', (store) => store.get(key));
  }

  async set(key: string, value: unknown): Promise<void> {
    await this._request('readwrite', (store) => store.put(value, key));
  }

  async delete(key: string): Promise<void> {
    await this._request('readwrite', (store) => store.delete(key));
  }

  private _open(): Promise<IDBDatabase> {
    this._db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
    });
    return this._db;
  }

  private async _request<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    const db = await this._open();
    return new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  }
}
