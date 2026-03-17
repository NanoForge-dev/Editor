import { clearDB } from '$lib/components/Utils/Storage/db';
import { listFiles, loadFile, saveFile } from '$lib/components/Utils/Storage/fileSystem';

export async function loadRemoteProject() {
  const response = await fetch('/fs?/=readDirRec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dirPath: '/' }),
  });

  const result = await response.json();

  if (!result.success) throw new Error(result.errorMsg);

  await clearDB();

  for (const item of result.dirContent) {
    if (item.type === 'file') {
      const fileRes = await fetch('/fs?/=readFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: item.name }),
      });
      const fileResult = await fileRes.json();

      if (fileResult.success) {
        await saveFile(item.name, fileResult.fileContent);
      }
    }
  }
}

export async function pushLocalProject() {
  console.log('🔄 Push projet vers serveur distant...');

  const localFiles = await listFiles();

  const pushPromises = localFiles.map(async (file) => {
    const content = await loadFile(file.id);

    const formData = new FormData();
    formData.append('filePath', file.id);
    formData.append('fileContent', content);

    await fetch('/fs?/writeFile', {
      method: 'POST',
      body: JSON.stringify({
        filePath: formData.get('filePath'),
        fileContent: formData.get('fileContent'),
      }),
    });
  });

  await Promise.all(pushPromises);
}
