import { deserialize } from '$app/forms';

import { type DirectoryRec, ProjectApi } from '$lib/components/Utils/api/project-api';
import { env, save } from '$lib/components/Widget/EditorGame/game.svelte';
import type { IManifest } from '$lib/loader/client/types/manifest.type';
import type { Save } from '$lib/loader/client/types/save.type';
import type { EditorComponentManifest } from '@nanoforge-dev/ecs-lib';
import { FileSystemDirectory } from '@utils-client/file-system';
import { projectFileSystem } from '@utils-client/local-file-system/project-file-system';

export class LocalAPI extends ProjectApi {
  async createProject(formData: FormData): Promise<void> {
    const resp = await fetch('/cli?/new', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData.entries())),
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
  async buildProject(): Promise<void> {
    await this._generateProject();
    const resp = await fetch('/cli?/build', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const result = deserialize(await resp.text());
    if (result.type !== 'success') {
      if (result.type === 'failure' && result.data) throw new Error(result.data.errorMsg as string);
      throw new Error('Failed to start project');
    }
  }

  async addComponent(componentName: string): Promise<void> {
    const resp = await fetch('/cli?/addComponent', {
      method: 'POST',
      body: JSON.stringify({
        componentName,
      }),
    });
    const result = deserialize(await resp.text());
    if (result.type !== 'success') {
      if (result.type === 'failure' && result.data) throw new Error(result.data.errorMsg as string);
      throw new Error('Failed to start project');
    }
  }

  async fetchSave(side: 'client' | 'server'): Promise<void> {
    const res = await fetch(`/game-loader?/getSave`, {
      method: 'POST',
      body: JSON.stringify({ side }),
    });

    const saveResult = deserialize(await res.text());
    if (saveResult.type !== 'success' || !saveResult.data) {
      if (saveResult.type === 'failure' && saveResult.data)
        throw new Error(saveResult.data.errorMsg as string);
      throw new Error('Failed to read remote directory');
    }
    save.set(saveResult.data.save as Save);
  }

  async fetchEnv(side: 'client' | 'server'): Promise<void> {
    const res = await fetch(`/game-loader?/getEnv`, {
      method: 'POST',
      body: JSON.stringify({ side }),
    });

    const envResult = deserialize(await res.text());
    if (envResult.type !== 'success' || !envResult.data) {
      if (envResult.type === 'failure' && envResult.data)
        throw new Error(envResult.data.errorMsg as string);
      throw new Error('Failed to read remote directory');
    }
    env.set(envResult.data.env as Record<string, string>);
  }

  async getComponentManifest(
    componentPath: string,
    side: 'client' | 'server',
  ): Promise<EditorComponentManifest> {
    const res = await fetch(`/game-loader?/getComponentManifest`, {
      method: 'POST',
      body: JSON.stringify({ side, componentPath }),
    });
    const manifestResult = deserialize(await res.text());
    if (manifestResult.type !== 'success' || !manifestResult.data) {
      if (manifestResult.type === 'failure' && manifestResult.data)
        throw new Error(manifestResult.data.errorMsg as string);
      throw new Error('Failed to read remote directory');
    }
    return manifestResult.data.manifest as EditorComponentManifest;
  }

  async getGameLoadManifest(side: 'client' | 'server'): Promise<IManifest> {
    const res = await fetch(`/game-loader?/getManifest`, {
      method: 'POST',
      body: JSON.stringify({ side }),
    });
    const manifestResult = deserialize(await res.text());
    if (manifestResult.type !== 'success' || !manifestResult.data) {
      if (manifestResult.type === 'failure' && manifestResult.data)
        throw new Error(manifestResult.data.errorMsg as string);
      throw new Error('Failed to read remote directory');
    }
    return manifestResult.data.manifest as IManifest;
  }

  async getGameBuildFile(
    filePath: string,
    encoding: string,
    side: 'client' | 'server',
  ): Promise<string> {
    const res = await fetch('/game-loader?/getBuildFile', {
      method: 'POST',
      body: JSON.stringify({
        side,
        filePath,
        encoding,
      }),
    });
    const fileResult = deserialize(await res.text());
    if (fileResult.type !== 'success' || !fileResult.data) {
      if (fileResult.type === 'failure' && fileResult.data) {
        throw Error(fileResult.data.errorMsg as string);
      }
      throw Error('Failed to read remote directory');
    }
    return fileResult.data.fileContent as string;
  }

  async _generateProject(): Promise<void> {
    const resp = await fetch('/cli?/generate', {
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
