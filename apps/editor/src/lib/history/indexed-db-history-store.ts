import type { HistoryStore, PersistedEntry } from '@nanoforge-dev/editor-history';

const DATABASE = 'nanoforge-history';
const STORE = 'contexts';

const request = <T>(operation: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });

let database: Promise<IDBDatabase | undefined> | undefined;
const open = () =>
  (database ??= new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(undefined);
    const opening = indexedDB.open(DATABASE, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => resolve(undefined);
  }));

/** Histories kept in the browser (IndexedDB) per project, across reloads. */
export const indexedDbHistoryStore = (projectId: string): HistoryStore => ({
  async load(contextId) {
    const db = await open();
    if (!db) return undefined;
    const store = db.transaction(STORE, 'readonly').objectStore(STORE);
    return (await request(store.get(`${projectId}:${contextId}`))) as PersistedEntry[] | undefined;
  },
  async save(contextId, entries) {
    const db = await open();
    if (!db) return;
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const key = `${projectId}:${contextId}`;
    if (entries.length) await request(store.put(entries, key));
    else await request(store.delete(key));
  },
});
