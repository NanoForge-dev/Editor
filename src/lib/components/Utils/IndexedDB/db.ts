import { openDB } from 'idb';

const dbName = 'NanoForge';
let dbPromise: Promise<any> | null = null;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function initDB() {
  await getDB();
}

export async function clearDB() {
  const db = await getDB();
  const tx = db.transaction('files', 'readwrite');
  const store = tx.objectStore('files');

  await store.clear();

  await tx.done;
}
