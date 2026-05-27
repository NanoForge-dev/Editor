import { IndexedDBObject } from './idb-object';

const DB_NAME = 'nanoforge';

export class IndexedDB {
  private _db: IDBDatabase | undefined;

  protected constructor() {}

  protected get db(): IDBDatabase {
    if (!this._db) {
      throw new Error('Database is not open');
    }
    return this._db;
  }

  protected async open(
    version?: number,
    upgrade?: (db: IDBDatabase) => Promise<void>,
  ): Promise<void> {
    const window = (await import('@utils-client/window')).default;
    if (!window.indexedDB) {
      throw new Error("Your browser doesn't support a stable version of IndexedDB.");
    }
    const request = window.indexedDB.open(DB_NAME, version ?? 1);

    [this._db] = await Promise.all([
      new Promise<IDBDatabase>((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      }),
      new Promise<Promise<void> | undefined>((resolve) => {
        request.onupgradeneeded = () => {
          upgrade?.(request.result);
        };
        // * I don't know how to do it :/
        setTimeout(resolve, 500);
      }),
    ]);
  }

  protected close() {
    this._db?.close();
  }

  protected createStore(name: string, keyPath?: string): void {
    this._assertDB();

    this._db!.createObjectStore(name, { keyPath });
  }

  protected getStore(name: string) {
    this._assertDB();

    return new IndexedDBObject(this._db!.transaction(name, 'readwrite').objectStore(name));
  }

  protected deleteStore(name: string) {
    this._assertDB();

    this._db!.deleteObjectStore(name);
  }

  private _assertDB() {
    if (!this._db) {
      throw new Error('Database is not open');
    }
  }
}
