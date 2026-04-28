import { Exception } from '@utils-server/exception';
import type { Context } from '@utils-server/request-handler';

import { resolveEnv } from './env';

type Part = 'client' | 'server';

export class Loader {
  private readonly _projectPath: string;

  constructor(context: Context) {
    if (!context.project) throw new Exception('Bad Request', 'Project is not defined', 400);
    this._projectPath = context.project.path;
  }

  getEnv(part: Part) {
    return resolveEnv(part, this._projectPath);
  }
}
