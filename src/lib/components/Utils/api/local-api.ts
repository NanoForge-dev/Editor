import { deserialize } from '$app/forms';

import { type DirectoryRec, ProjectApi } from '$lib/components/Utils/api/project-api';

import { FileSystemDirectory } from '@utils-client/file-system';
import { projectFileSystem } from '@utils-client/local-file-system/project-file-system';

export class LocalAPI extends ProjectApi {
  async createProject(formData: FormData): Promise<void> {
    const resp = await fetch('/cli?/createProject', {
      method: 'POST',
      body: JSON.stringify({
        projectPath: '.',
        // Remove until we fixed https://github.com/NanoForge-dev/CLI/issues/126
        // projectPath: formData.get('projectPath'),
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

  async playProject(): Promise<void> {
    const resp = await fetch('/cli?/startDevProject', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const result = deserialize(await resp.text());
    if (result.type !== 'success') {
      if (result.type === 'failure' && result.data) throw new Error(result.data.errorMsg as string);
      throw new Error('Failed to start project');
    }
  }

  async stopProject(): Promise<void> {
    const resp = await fetch('/cli?/stopProject', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const result = deserialize(await resp.text());
    if (result.type !== 'success') {
      if (result.type === 'failure' && result.data) throw new Error(result.data.errorMsg as string);
      throw new Error('Failed to stop project');
    }
  }

  async uploadFiles(): Promise<void> {
    await this._uploadDirectoryRec(await projectFileSystem.getDirectory('/'), []);
  }

  async downloadFiles(): Promise<Promise<void>[]> {
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

    await projectFileSystem.clear();
    return this._downloadDirectoryRec(readDirResult.data.dirContent as DirectoryRec);
  }

  private async _uploadDirectoryRec(directory: FileSystemDirectory, path: string[]): Promise<void> {
    const children = await directory.getChildren();

    for (const [name, handle] of children) {
      const childPath = [...path, name];

      if (handle instanceof FileSystemDirectory) {
        await this._uploadDirectoryRec(handle, childPath);
      } else {
        const content = await handle.read();

        const formData = new FormData();
        formData.append('filePath', childPath.join('/'));
        formData.append('fileContent', content);

        await fetch('/fs?/writeFile', {
          method: 'POST',
          body: JSON.stringify({
            filePath: formData.get('filePath'),
            fileContent: formData.get('fileContent'),
          }),
        });
      }
    }
  }

  private async _downloadDirectoryRec(
    dir: DirectoryRec,
    currentPath: string = '',
  ): Promise<Promise<void>[]> {
    const promises: Promise<void>[] = [];

    for (const file of dir.files) {
      const filePath = '/' + currentPath + file;
      const filePromise = fetch('/fs?/readFile', {
        method: 'POST',
        body: JSON.stringify({ filePath: filePath }),
      }).then(async (fileRes) => {
        const fileResult = deserialize(await fileRes.text());
        if (fileResult.type === 'success' && fileResult.data) {
          const file = await projectFileSystem.getFile(filePath, true);
          await file.write(fileResult.data.fileContent as string);
        }
      });
      promises.push(filePromise);
    }

    for (const [dirName, children] of Object.entries(dir.directories)) {
      await projectFileSystem.getDirectory(currentPath + dirName, true);
      if (dirName !== 'node_modules') {
        const dirPromise: Promise<void> = this._downloadDirectoryRec(
          children,
          currentPath + dirName + '/',
        ).then((subDirPromises) => {
          promises.push(...subDirPromises);
          return;
        });

        promises.push(dirPromise);
      }
    }
    return promises;
  }
}
