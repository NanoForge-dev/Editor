import { getDB } from '$lib/components/Storage/db';

export async function saveTab(fileName: string, content: string) {
  const db = await getDB();
  const tx = db.transaction('tabs', 'readwrite');
  const store = tx.objectStore('tabs');
  await store.put({ id: fileName, content, lastModified: Date.now() });
  await tx.done;
}
