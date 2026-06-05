import { join } from 'path';

import {
  FileSystem,
  type ProjectFile,
  directoryContentToFileEntries,
} from '$lib/server/file-system';

import type { ProjectHandler } from '../project-handler';
import { resolveEnv } from './env';
import type { Manifest } from './types';

export class Loader {
  private readonly handler: ProjectHandler;
  private readonly _fs: FileSystem;
  private readonly _basePath: string;

  constructor(handler: ProjectHandler) {
    this.handler = handler;
    this._basePath = join(this.handler._path, '.nanoforge', this.handler._part);
    this._fs = new FileSystem(this._basePath);
  }

  getEnv(): Record<string, string> {
    return resolveEnv(this.handler._part, this.handler._path);
  }

  getManifest(): Manifest {
    const entries = directoryContentToFileEntries(this._fs.getDirectory('.').read(true));
    return {
      version: '1.0.0',
      files: entries.map((path) => ({ path })),
    };
  }

  getFile(path: string): ProjectFile {
    return this._fs.getFile(path);
  }
}
