/**
 * The editor's IndexedDB database of cached projects. Every store is created here, with one
 * version: opening it elsewhere at another version would fail (`VersionError`).
 */
export const CACHE_DB = 'nanoforge-editor';
const VERSION = 2;

/** `user\0projectId` → the project's file tree. */
export const TREES = 'trees';
/** sha1 → {@link BlobRecord}: size and last use of each cached content. */
export const BLOBS = 'blobs';
/** `user\0projectId` → {@link ProjectRecord}. */
export const PROJECTS = 'projects';

export interface BlobRecord {
  readonly user: string;
  readonly hash: string;
  readonly size: number;
  /** Last read or write, in ms (written at most once a minute). */
  readonly used: number;
}

export interface ProjectRecord {
  readonly user: string;
  readonly projectId: string;
  /** Last time the project was opened, in ms. */
  readonly opened: number;
}

export const projectKey = (user: string, projectId: string) => `${user}\0${projectId}`;
export const blobKey = (user: string, hash: string) => `${user}\0${hash}`;

export const isCacheDbSupported = (): boolean => typeof indexedDB !== 'undefined';

/** Opens the database; version 1 (trees by project id only) is dropped on upgrade. */
export const openCacheDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB, VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 2 && db.objectStoreNames.contains(TREES)) db.deleteObjectStore(TREES);
      for (const store of [TREES, BLOBS, PROJECTS])
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  });

/** Runs requests in one transaction; resolves with the last request's result. */
export const transact = async <T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  run: (transaction: IDBTransaction) => IDBRequest | IDBRequest[] | undefined,
): Promise<T> => {
  const db = await openCacheDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(stores, mode);
      const requests = run(transaction);
      const last = Array.isArray(requests) ? requests.at(-1) : requests;
      transaction.oncomplete = () => resolve(last?.result as T);
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB aborted'));
    });
  } finally {
    db.close();
  }
};

/** Every value of a store whose key starts with `prefix`. */
export const valuesWithPrefix = <T>(store: string, prefix: string): Promise<T[]> =>
  transact<T[]>(store, 'readonly', (transaction) =>
    transaction.objectStore(store).getAll(IDBKeyRange.bound(prefix, `${prefix}￿`)),
  );

/** Every key of a store that starts with `prefix`. */
export const keysWithPrefix = (store: string, prefix: string): Promise<string[]> =>
  transact<IDBValidKey[]>(store, 'readonly', (transaction) =>
    transaction.objectStore(store).getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`)),
  ).then((keys) => keys.map(String));
