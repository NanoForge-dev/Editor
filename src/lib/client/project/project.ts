import { type ActionClient, getActionClient } from '$lib/client/action';
import { InfoHandler } from '$lib/client/info';
import { Loader } from '$lib/client/loader';
import { PackageHandler } from '$lib/client/project/package-handler';
import { SaveHandler } from '$lib/client/project/save-handler';
import { SyncFileSystem } from '$lib/client/sync-file-system';

export class Project {
  private _info: InfoHandler | undefined;
  private _actions: ActionClient | undefined;
  private _fs: SyncFileSystem | undefined;
  private _loader: Loader | undefined;
  private _save: SaveHandler | undefined;
  private _packageHandler: PackageHandler | undefined;
  private _inited = false;

  static reset(): void {
    InfoHandler.reset();
  }

  constructor(public id: string) {
    this._save = new SaveHandler(this);
    this._packageHandler = new PackageHandler(this);
  }

  async init(): Promise<Project> {
    await this.save.init();
    await this.packages.init();
    this._inited = true;
    return this;
  }

  isReady(): boolean {
    return this._inited;
  }

  get info(): InfoHandler {
    if (!this._info) this._info = new InfoHandler(this);
    return this._info;
  }

  get actions(): ActionClient {
    if (!this._actions) this._actions = getActionClient(this.id);
    return this._actions;
  }

  get fs(): SyncFileSystem {
    if (!this._fs) this._fs = new SyncFileSystem(this, 'project');
    return this._fs;
  }

  get loader(): Loader {
    if (!this._loader) this._loader = new Loader(this);
    return this._loader;
  }

  get save(): SaveHandler {
    if (!this._save) this._save = new SaveHandler(this);
    return this._save;
  }

  get packages(): PackageHandler {
    if (!this._packageHandler) this._packageHandler = new PackageHandler(this);
    return this._packageHandler;
  }
}
