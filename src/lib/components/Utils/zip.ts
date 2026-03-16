import { getDB } from '$lib/components/Storage/db';
import { saveFile } from '$lib/components/Storage/fileSystem';
import fileSaver from 'file-saver';
import JSZip from 'jszip';

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

export async function importFromZip(zipFile: File): Promise<void> {
  const zip = new JSZip();

  await zip.loadAsync(zipFile);
  const zipFiles = Object.values(zip.files);

  for (const zipFile of zipFiles) {
    if (!zipFile.dir) {
      const content = await zipFile.async('string');
      const filePath = zipFile.name;
      await saveFile(filePath, content);
    }
  }
}
