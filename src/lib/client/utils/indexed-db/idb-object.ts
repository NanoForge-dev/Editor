export class IndexedDBObject {
  private readonly _store: IDBObjectStore;

  constructor(store: IDBObjectStore) {
    this._store = store;
  }

  get store(): IDBObjectStore {
    return this._store;
  }

  get<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const request = this._store.get(key);
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  set<T>(key: string, data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = this._store.put(data, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  delete(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = this._store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
