import { getDB } from '$lib/components/Storage/db';

export interface File {
  id: string;
  lastModified: number;
}

export interface FolderContent {
  name: string;
  type: 'file' | 'folder';
  lastModified?: number;
}

export async function listFiles(): Promise<Array<File>> {
  const db = await getDB();
  const tx = db.transaction('files', 'readonly');
  const store = tx.objectStore('files');

  const allFiles = await store.getAll();

  return allFiles.map((file: File) => ({
    id: file.id,
    lastModified: file.lastModified,
  }));
}

export async function listFolders(): Promise<string[]> {
  const folders = new Set<string>();
  const files = await listFiles();

  for (const file of files) {
    const parts = file.id.split('/');

    parts.pop();

    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      folders.add(current);
    }
  }

  return Array.from(folders).sort();
}

export async function listFolderContents(path: string = ''): Promise<Array<FolderContent>> {
  const allFiles = await listFiles();
  let cleanPath = path.startsWith('/') ? path.substring(1) : path;
  cleanPath = cleanPath.endsWith('/') || cleanPath === '' ? cleanPath : cleanPath.concat('/');

  const items = new Map<string, FolderContent>();

  const files = allFiles.filter((file) => {
    const filePath = file.id;
    return filePath.startsWith(cleanPath);
  });

  for (const file of files) {
    const relativePath = file.id.substring(cleanPath.length);
    const isFolderIndex = relativePath.indexOf('/');
    const name = isFolderIndex >= 0 ? relativePath.substring(0, isFolderIndex) : relativePath;

    items.set(name, {
      name,
      type: isFolderIndex >= 0 ? 'folder' : 'file',
      lastModified: file.lastModified,
    });
  }

  return Array.from(items.values()).sort((a, b) => {
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function saveFile(fileName: string, content: string) {
  const db = await getDB();
  const tx = db.transaction('files', 'readwrite');
  const store = tx.objectStore('files');
  await store.put({ id: fileName, content, lastModified: Date.now() });
  await tx.done;
}

export async function loadFile(fileName: string): Promise<string> {
  const db = await getDB();
  const tx = db.transaction('files', 'readonly');
  const store = tx.objectStore('files');
  const file = await store.get(fileName);
  return file?.content || '';
}
