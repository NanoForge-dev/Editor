import { deserialize } from '$app/forms';
import { saveFile } from '$lib/components/Utils/IndexedDB/fileSystem';
import { gameProps } from '$lib/loader/client/game';

import { type IExtendedManifestFile, type IManifest } from './types/manifest.type.ts';

export async function loadGameFiles(filesProm: Promise<IExtendedManifestFile>[]): Promise<void> {
  gameProps.files = new Map<string, string>();
  gameProps.mainModule = undefined;
  filesProm.forEach((fileProm) => {
    fileProm.then(async (file) => {
      if (file.gamePath === '/main.js') {
        const resModule = await loadScript(file);
        if (resModule) gameProps.mainModule = resModule;
        return;
      }
      gameProps.files.set(file.gamePath, file.localPath);
    });
  });
}

const loadScript = async (file: IExtendedManifestFile): Promise<any | undefined> => {
  const res = await import(file.localPath);
  if (res['main']) return res;
};

export function fetchGameFiles(manifest: IManifest): Promise<IExtendedManifestFile>[] {
  return manifest.files.map(
    (file: string): Promise<IExtendedManifestFile> =>
      fetch('/game-loader?/getBuildFile', {
        method: 'POST',
        body: JSON.stringify({ side: 'client', filePath: file }),
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
        const browserPath = '.nanoforge/client/' + file;
        await saveFile(browserPath, fileResult.data.fileContent as string);
        // TODO URL.createObjectURL(await (new FileSystemHandler(root).getFile()));
        return {
          gamePath: file,
          localPath: 'TODO BLOB URL',
        };
      }),
  );
}
