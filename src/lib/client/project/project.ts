import { type ActionClient, actions } from '$lib/client/action';
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

  static reset(): void {
    InfoHandler.reset();
  }

  constructor(public id: string) {
    this._save = new SaveHandler(this);
    this._packageHandler = new PackageHandler(this);
  }

  async init(): Promise<Project> {
    // @todo add init of sub parts like save
    return this;
  }

  get info(): InfoHandler {
    if (!this._info) this._info = new InfoHandler(this);
    return this._info;
  }

  get actions(): ActionClient {
    if (!this._actions) this._actions = actions;
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

  get package(): PackageHandler {
    if (!this._packageHandler) this._packageHandler = new PackageHandler(this);
    return this._packageHandler;
  }
}
