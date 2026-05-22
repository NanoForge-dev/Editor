import type { Project } from '$lib/client/project';
import { SyncFileSystem } from '$lib/client/sync-file-system';

import type { RawEventEmitter } from './types/event-emitter.type';
import type { IGameOptions } from './types/game.type';
import type { IExtendedManifestFile, IManifest } from './types/manifest.type';

type MainFunction = (options: IGameOptions) => Promise<void>;

export class Loader {
  private readonly fs: SyncFileSystem;

  constructor(private readonly core: Project) {
    this.fs = new SyncFileSystem(this.core, 'build');
  }

  async build(): Promise<void> {
    await this.core.actions.loader.build();
  }

  async start(container: HTMLDivElement): Promise<void> {
    const manifest = await this.fetchManifest();
    const env = await this.fetchEnv();
    const { mainFile, files } = await this.resolveGameFiles(manifest);
    const save = this.core.save.save;

    const main = await this.loadMainFile(mainFile);

    main({
      files,
      env,
      editor: {
        save,
        coreEvents: this.core.event._coreEvents as unknown as RawEventEmitter,
        editorEvents: this.core.event._editorEvents as unknown as RawEventEmitter,
      },
      container,
    }).then(() => console.log('Game started!'));
  }

  private async loadMainFile(file: string): Promise<MainFunction> {
    const res = await import(/* @vite-ignore */ file);
    if (res['main']) return res['main'];
    throw new Error('No main function found in the main.js file');
  }

  private fetchEnv(): Promise<Record<string, string | undefined>> {
    return this.core.actions.loader.env();
  }

  private fetchManifest(): Promise<IManifest> {
    return this.core.actions.loader.manifest();
  }

  private async resolveGameFiles(
    manifest: IManifest,
  ): Promise<{ mainFile: string; files: Map<string, string> }> {
    const files = await this.fetchFiles(manifest);

    let mainFile: string | undefined;
    const resMap = new Map<string, string>();

    for (const file of files) {
      if (file.gamePath === '/main.js') {
        mainFile = file.localPath;
        continue;
      }
      resMap.set(file.gamePath, file.localPath);
    }

    if (!mainFile) throw new Error('No main.js file found in the manifest');
    return { mainFile, files: resMap };
  }

  private async fetchFiles(manifest: IManifest): Promise<IExtendedManifestFile[]> {
    return await Promise.all(
      manifest.files.map(async ({ path }) => {
        const file = await this.fs.getFile(path);
        await file.fetch();
        return { gamePath: path, localPath: await file.getUrl() };
      }),
    );
  }
}
