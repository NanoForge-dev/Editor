import { join } from 'path';

import type { Api } from '$lib/server/api';
import type { Cli } from '$lib/server/cli';
import { FileSystem } from '$lib/server/file-system';

import { Exception } from '@utils/exception';
import type { Part } from '@utils/types';

import type { Context, Handler } from '@utils-server/request-handler';

import { LibraryHandler } from './library/library-handler';
import { Loader } from './loader';
import { PackageHandler } from './package/package-handler';
import { SaveHandler } from './save/save-handler';

export class ProjectHandler {
  public readonly _path: string;
  public readonly _part: Part;
  public readonly _cli: Cli;
  public readonly _api: Api;
  public readonly _rootFs: FileSystem;

  private _fs: FileSystem | undefined;
  private _loader: Loader | undefined;
  private _save: SaveHandler | undefined;
  private _package: PackageHandler | undefined;
  private _library: LibraryHandler | undefined;

  constructor(handler: Handler, context: Context, part: Part) {
    if (!context.project) throw new Exception('Bad Request', 'Project missing in context', 400);
    this._path = context.project.path;
    this._part = part;
    this._cli = handler.cli;
    this._api = handler.api;
    this._rootFs = handler.fs;
  }

  /**
   * Get the file system of the project content
   * This file system has his root at /<client|server>
   */
  get fs(): FileSystem {
    if (!this._fs) this._fs = new FileSystem(join(this._path, this._part));
    return this._fs;
  }

  /**
   * Get the loader functions of the project
   */
  get loader(): Loader {
    if (!this._loader) this._loader = new Loader(this);
    return this._loader;
  }

  get save(): SaveHandler {
    if (!this._save) this._save = new SaveHandler(this);
    return this._save;
  }

  get package(): PackageHandler {
    if (!this._package) this._package = new PackageHandler(this);
    return this._package;
  }

  get library(): LibraryHandler {
    if (!this._library) this._library = new LibraryHandler(this);
    return this._library;
  }
}
