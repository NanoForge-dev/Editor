import { type ActionClient, getActionClient } from '$lib/client/action';
import { ProjectFileSystem } from '$lib/client/file-system';
import { InfoHandler } from '$lib/client/info';

export class Project {
  private _info: InfoHandler | undefined;
  private _actions: ActionClient | undefined;
  private _fs: ProjectFileSystem | undefined;

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

  get fs(): ProjectFileSystem {
    if (!this._fs) this._fs = new ProjectFileSystem(this);
    return this._fs;
  }
}
