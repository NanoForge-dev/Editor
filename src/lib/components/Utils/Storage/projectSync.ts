import { listFiles, loadFile } from '$lib/components/Utils/Storage/fileSystem';

export async function createProject(formData: FormData) {
  await fetch('/cli?/createProject', {
    method: 'POST',
    body: JSON.stringify({
      projectPath: formData.get('projectPath'),
      projectName: formData.get('projectName'),
      packageManager: formData.get('packageManager'),
      language: formData.get('language'),
      strictTypeChecking: formData.get('strictTypeChecking') ?? false,
      multiplayerServer: formData.get('multiplayerServer') ?? false,
      skipDependencyInstallation: formData.get('skipDependencyInstallation') ?? false,
      dockerContainerization: formData.get('dockerContainerization') ?? false,
    }),
  });
}

/*export async function loadRemoteProject() {
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
}*/

export async function pushLocalProject() {
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
