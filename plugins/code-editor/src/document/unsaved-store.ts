/** Unsaved text of a file, and the disk version it was based on. */
export interface UnsavedText {
  readonly text: string;
  /** Hash of the file on disk when editing started (detects disk changes meanwhile). */
  readonly baseHash: string | null;
  readonly time: number;
}

export interface UnsavedStore {
  get(path: string): Promise<UnsavedText | undefined>;
  set(path: string, value: UnsavedText): Promise<void>;
  delete(path: string): Promise<void>;
}

const DATABASE = 'nanoforge-code-editor';
const STORE = 'unsaved';

const request = <T>(operation: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });

/**
 * Keeps unsaved edits in the browser (IndexedDB) per project, so they survive a reload until
 * saved or reverted. Falls back to memory when IndexedDB is unavailable.
 */
export const createUnsavedStore = (projectId: string): UnsavedStore => {
  const memory = new Map<string, UnsavedText>();
  const key = (path: string) => `${projectId}:${path}`;
  let database: Promise<IDBDatabase | undefined> | undefined;
  const open = () =>
    (database ??= new Promise<IDBDatabase | undefined>((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(undefined);
      const opening = indexedDB.open(DATABASE, 1);
      opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => resolve(undefined);
    }));
  const store = async (mode: IDBTransactionMode) =>
    (await open())?.transaction(STORE, mode).objectStore(STORE);

  return {
    async get(path) {
      const objects = await store('readonly');
      if (!objects) return memory.get(key(path));
      return (await request(objects.get(key(path)))) as UnsavedText | undefined;
    },
    async set(path, value) {
      const objects = await store('readwrite');
      if (!objects) memory.set(key(path), value);
      else await request(objects.put(value, key(path)));
    },
    async delete(path) {
      const objects = await store('readwrite');
      if (!objects) memory.delete(key(path));
      else await request(objects.delete(key(path)));
    },
  };
};
