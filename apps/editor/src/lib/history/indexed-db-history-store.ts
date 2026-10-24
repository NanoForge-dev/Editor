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

/** File histories are dropped after a month without a change, and past the 200 newest. */
const FILE_HISTORY_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const FILE_HISTORY_MAX = 200;

/**
 * Removes the old `file:*` histories of a project: one is kept per file ever edited, and
 * nothing else would ever delete them.
 */
const pruneFileHistories = async (db: IDBDatabase, projectId: string): Promise<void> => {
  const prefix = `${projectId}:file:`;
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
  const keys = (await request(store.getAllKeys(range))) as string[];
  const values = (await request(store.getAll(range))) as PersistedEntry[][];
  const dated = keys
    .map((key, index) => ({ key, time: Math.max(0, ...(values[index] ?? []).map((e) => e.time)) }))
    .sort((a, b) => b.time - a.time);
  const now = Date.now();
  const stale = dated.filter(
    (entry, index) => index >= FILE_HISTORY_MAX || now - entry.time > FILE_HISTORY_MAX_AGE_MS,
  );
  if (!stale.length) return;
  const writing = db.transaction(STORE, 'readwrite').objectStore(STORE);
  await Promise.all(stale.map((entry) => request(writing.delete(entry.key))));
};

const pruned = new Set<string>();

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
    if (!pruned.has(projectId)) {
      pruned.add(projectId);
      await pruneFileHistories(db, projectId).catch(() => pruned.delete(projectId));
    }
  },
});
