import { Cli } from '$lib/server/cli';
import { FileSystem } from '$lib/server/file-system';

import type { Part } from '@utils/types';

import type { Context } from '@utils-server/request-handler';

import { PackageHandler } from './package/package-handler';
import { SaveHandler } from './save/save-handler';

export class ProjectHandler {
  public readonly _part: Part;
  public readonly _cli: Cli;
  public readonly _fs: FileSystem;

  private readonly _save: SaveHandler;
  private readonly _package: PackageHandler;

  constructor(context: Context, part: Part) {
    this._part = part;
    this._cli = new Cli(context);
    this._fs = new FileSystem(context);

    this._fs.getDirectory(this._part).assertExists();

    this._save = new SaveHandler(this);
    this._package = new PackageHandler(this);
  }

  get package(): PackageHandler {
    return this._package;
  }

  get save(): SaveHandler {
    return this._save;
  }
}
