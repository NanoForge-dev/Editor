import { Exception } from '@utils-server/exception';
import type { Context } from '@utils-server/request-handler/context';

import { resolveRootPath } from './file-system.functions';
import { ProjectDirectory } from './project-directory';
import { ProjectFile } from './project-file';

export class FileSystem {
  private readonly _rootPath: string;

  constructor(context: Context) {
    if (!context.project) {
      throw new Exception('Bad Request', 'Project is not defined', 400);
    }

    this._rootPath = resolveRootPath(context.project.path);
  }

  getDirectory(path: string) {
    return new ProjectDirectory(path, this._rootPath);
  }

  getFile(path: string) {
    return new ProjectFile(path, this._rootPath);
  }
}
