import { deserialize } from '$app/forms';
import { gameProps } from '$lib/loader/client/game';
import { projectFileSystem } from '@utils-client/local-file-system/project-file-system';

import { type IExtendedManifestFile, type IManifest } from './types/manifest.type.ts';

export function loadGameFiles(filesProm: Promise<IExtendedManifestFile>[]): Promise<void>[] {
  gameProps.files = new Map<string, string>();
  gameProps.mainModule = undefined;
  return filesProm.map(async (fileProm) => {
    const file = await fileProm;
    if (file.gamePath === '/main.js') {
      const resModule = await loadScript(file);
      if (resModule) gameProps.mainModule = resModule;
      return;
    }
    gameProps.files.set(file.gamePath, file.localPath);
  });
}

const loadScript = async (file: IExtendedManifestFile): Promise<any | undefined> => {
  const res = await import(/* @vite-ignore */ file.localPath);
  if (res['main']) return res;
};

export function fetchGameFiles(manifest: IManifest): Promise<IExtendedManifestFile>[] {
  return manifest.files.map((filePath: string): Promise<IExtendedManifestFile> => {
    const fileIsWasm = filePath.endsWith('.wasm');
    return fetch('/game-loader?/getBuildFile', {
      method: 'POST',
      body: JSON.stringify({
        side: 'client',
        filePath: filePath,
        encoding: fileIsWasm ? 'base64' : 'utf8',
      }),
    }).then(async (res: Response): Promise<IExtendedManifestFile> => {
      if (!res.ok) {
        throw Error("Can't retrieve game file");
      }
      const fileResult = deserialize(await res.text());
      if (fileResult.type !== 'success' || !fileResult.data) {
        if (fileResult.type === 'failure' && fileResult.data) {
          throw Error(fileResult.data.errorMsg as string);
        }
        throw Error('Failed to read remote directory');
      }
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
        await gameFile.writeBinary(fileResult.data.fileContent as string);
      } else {
        await gameFile.write(fileResult.data.fileContent as string);
      }
      const localPath = await gameFile.getUrl(fileIsWasm ? 'application/wasm' : 'text/javascript');
      return {
        gamePath: filePath,
        localPath,
      };
    });
  });
}
