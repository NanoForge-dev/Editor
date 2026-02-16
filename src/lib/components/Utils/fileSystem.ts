import fileSaver from 'file-saver';
import { openDB } from 'idb';
import JSZip from 'jszip';

const dbName = 'NanoForge';
let dbPromise: Promise<any> | null = null;

export interface File {
  id: string;
  lastModified: number;
}

async function getDB() {
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

export async function listFolderContents(
  path: string = '',
): Promise<Array<{ name: string; type: 'file' | 'folder'; lastModified?: number }>> {
  const allFiles = await listFiles();
  const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;

  const items = new Map<string, { name: string; type: 'file' | 'folder'; lastModified?: number }>();

  const files = allFiles.filter((file) => {
    const filePath = file.id;
    if (cleanPath === '') {
      return !filePath.includes('/'); // Racine
    }
    return filePath.startsWith(cleanPath + '/') && !filePath.includes('/', cleanPath.length + 1);
  });

  for (const file of files) {
    const fileName = file.id.split('/').pop();
    const name = cleanPath === '' ? file.id : (fileName ?? file.id);
    items.set(name, { name, type: 'file' as const, lastModified: file.lastModified });
  }

  const folders = new Set<string>();
  for (const file of allFiles) {
    const filePath = file.id;
    if (cleanPath === '') {
      const firstFolder = filePath.split('/')[0];
      if (firstFolder) folders.add(firstFolder);
    } else {
      const relativePath = filePath.substring(cleanPath.length + 1);
      const firstFolder = relativePath.split('/')[0];
      if (firstFolder) folders.add(firstFolder);
    }
  }

  for (const folder of folders) {
    if (!items.has(folder)) {
      items.set(folder, { name: folder, type: 'folder' as const });
    }
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

export async function loadFile(fileName: string) {
  const db = await getDB();
  const tx = db.transaction('files', 'readonly');
  const store = tx.objectStore('files');
  const file = await store.get(fileName);
  return file?.content || '';
}

function ensureFolder(zip: JSZip, path: string): JSZip {
  return zip.folder(path) ?? zip;
}

export async function exportToZip(filename: string = 'NanoForge.zip') {
  const db = await getDB();
  const tx = db.transaction('files', 'readonly');
  const store = tx.objectStore('files');

  const allFiles = await store.getAll();
  const zip = new JSZip();

  for (const file of allFiles) {
    const parts = file.id.split('/');
    let currentFolder = zip;

    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      const nextFolder = currentFolder.folder(folderName);
      if (nextFolder) {
        currentFolder = nextFolder;
      } else {
        currentFolder = ensureFolder(currentFolder, parts[i]);
      }
    }

    currentFolder.file(parts[parts.length - 1], file.content);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  fileSaver.saveAs(zipBlob, filename);
}
