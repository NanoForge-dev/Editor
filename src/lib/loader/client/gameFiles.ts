import { get } from 'svelte/store';

import { localApi } from '$lib/components/Utils/api/api';
import { files, mainModule } from '$lib/components/Widget/EditorGame/game.svelte';

import { projectFileSystem } from '@utils-client/local-file-system/project-file-system';

import { type IExtendedManifestFile, type IManifest } from './types/manifest.type';

export function loadGameFiles(filesProm: Promise<IExtendedManifestFile>[]): Promise<void>[] {
  files.set(new Map<string, string>());
  mainModule.set(undefined);
  return filesProm.map(async (fileProm) => {
    const file = await fileProm;
    if (file.gamePath === '/main.js') {
      const resModule = await loadScript(file);
      if (resModule) mainModule.set(resModule);
      return;
    }
    files.set(get(files).set(file.gamePath, file.localPath));
  });
}

const loadScript = async (file: IExtendedManifestFile): Promise<any | undefined> => {
  const res = await import(/* @vite-ignore */ file.localPath);
  if (res['main']) return res;
};

export function fetchGameFiles(manifest: IManifest): Promise<IExtendedManifestFile>[] {
  return manifest.files.map(async (filePath: string): Promise<IExtendedManifestFile> => {
    const fileIsWasm = filePath.endsWith('.wasm');
    const fileContent = await localApi.getGameBuildFile(
      filePath,
      fileIsWasm ? 'base64' : 'utf8',
      'client',
    );
    const browserPath = '/.nanoforge/client/' + filePath;
    const gameDir = await projectFileSystem.getDirectory(
      browserPath.substring(0, browserPath.lastIndexOf('/')),
      true,
    );
    const gameFile = await gameDir.getFile(
      browserPath.substring(browserPath.lastIndexOf('/') + 1),
      true,
    );
    if (fileIsWasm) {
      await gameFile.writeBinary(fileContent);
    } else {
      await gameFile.write(fileContent);
    }
    const localPath = await gameFile.getUrl(fileIsWasm ? 'application/wasm' : 'text/javascript');
    return {
      gamePath: filePath,
      localPath,
    };
  });
}
