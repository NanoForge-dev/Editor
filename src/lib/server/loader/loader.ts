import type { ReadStream } from 'fs';
import { join } from 'path';

import { FileSystem } from '$lib/server/file-system';
import { directoryContentToFileEntries } from '$lib/server/file-system/project-directory';

import type { Part } from '@utils/types';

import { Exception } from '@utils-server/exception';
import type { Context } from '@utils-server/request-handler';

import { resolveEnv } from './env';
import type { Manifest } from './types';

export class Loader {
  private readonly _projectPath: string;
  private readonly _fs: FileSystem;

  constructor(context: Context) {
    if (!context.project) throw new Exception('Bad Request', 'Project is not defined', 400);
    this._projectPath = context.project.path;
    this._fs = new FileSystem(context);
  }

  getEnv(part: Part): Record<string, string> {
    return resolveEnv(part, this._projectPath);
  }

  getManifest(part: Part): Manifest {
    const entries = directoryContentToFileEntries(
      this._fs.getDirectory(join('.nanoforge', part)).read(true),
      this._projectPath,
    );
    return {
      version: '1.0.0',
      files: entries.map((path) => ({ path })),
    };
  }

  getFile(part: Part, path: string): ReadStream {
    const fullPath = join('.nanoforge', part, `${path.startsWith('/') ? path.slice(1) : path}`);
    return this._fs.getFile(fullPath).readStream();
  }
}
