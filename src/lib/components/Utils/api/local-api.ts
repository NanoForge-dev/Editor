import { deserialize } from '$app/forms';
import { clearDB } from '$lib/components/Utils/IndexedDB/db';
import { listFiles, loadFile, saveFile } from '$lib/components/Utils/IndexedDB/fileSystem';
import { type DirectoryRec, ProjectApi } from '$lib/components/Utils/api/project-api';

export class LocalAPI extends ProjectApi {
  async createProject(formData: FormData): Promise<void> {
    const resp = await fetch('/cli?/createProject', {
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
    const result = deserialize(await resp.text());
    if (result.type !== 'success') {
      if (result.type === 'failure' && result.data) throw new Error(result.data.errorMsg as string);
      throw new Error('Failed to load remote project');
    }
  }

  async loadProject(formData: FormData): Promise<void> {
    const loadResp = await fetch('/load-project?/loadProject', {
      method: 'POST',
      body: JSON.stringify({ projectPath: formData.get('projectPath') }),
    });
    const loadResult = deserialize(await loadResp.text());
    if (loadResult.type !== 'success') {
      if (loadResult.type === 'failure' && loadResult.data)
        throw new Error(loadResult.data.errorMsg as string);
      throw new Error('Failed to load remote project');
    }
  }

  async uploadFiles(): Promise<void> {
    const localFiles = await listFiles();

    localFiles.map(async (file) => {
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
  }

  async downloadFiles(): Promise<void> {
    const readDirResp = await fetch('/fs?/readDirRec', {
      method: 'POST',
      body: JSON.stringify({ dirPath: '/' }),
    });

    const readDirResult = deserialize(await readDirResp.text());

    if (readDirResult.type !== 'success' || !readDirResult.data) {
      if (readDirResult.type === 'failure' && readDirResult.data)
        throw new Error(readDirResult.data.errorMsg as string);
      throw new Error('Failed to read remote directory');
    }

    await clearDB();
    await this._downloadDirectoryRec(readDirResult.data.dirContent as DirectoryRec);
  }

  private async _downloadDirectoryRec(dir: DirectoryRec, currentPath: string = ''): Promise<void> {
    for (const file of dir.files) {
      const fileRes = await fetch('/fs?/readFile', {
        method: 'POST',
        body: JSON.stringify({ filePath: '/' + currentPath + file }),
      });
      const fileResult = deserialize(await fileRes.text());

      if (fileResult.type === 'success' && fileResult.data) {
        await saveFile(currentPath + file, fileResult.data.fileContent as string);
      }
    }
    for (const [dirName, children] of Object.entries(dir.directories)) {
      if (dirName !== 'node_modules') {
        await this._downloadDirectoryRec(children, currentPath + dirName + '/');
      }
    }
  }
}
