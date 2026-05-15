import { type ActionClient, getActionClient } from '$lib/client/action';
import { InfoHandler } from '$lib/client/info';
import { Loader } from '$lib/client/loader';
import { SyncFileSystem } from '$lib/client/sync-file-system';

export class Project {
  private _info: InfoHandler | undefined;
  private _actions: ActionClient | undefined;
  private _fs: SyncFileSystem | undefined;
  private _loader: Loader | undefined;

  static reset(): void {
    InfoHandler.reset();
  }

  constructor(public id: string) {}

  get info(): InfoHandler {
    if (!this._info) this._info = new InfoHandler(this);
    return this._info;
  }

  get actions(): ActionClient {
    if (!this._actions) this._actions = getActionClient();
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
}
