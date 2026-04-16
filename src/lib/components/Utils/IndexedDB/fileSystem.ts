import { getDB } from '$lib/components/Utils/IndexedDB/db';

export async function loadFile(fileName: string): Promise<string> {
  const db = await getDB();
  const tx = db.transaction('files', 'readonly');
  const store = tx.objectStore('files');
  const file = await store.get(fileName);
  return file?.content || '';
}
