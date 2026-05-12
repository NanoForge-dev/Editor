import type { ReadStream } from 'fs';
import { join } from 'path';

import { directoryContentToFileEntries } from '$lib/server/file-system/project-directory';

import { type ProjectHandler } from '../project-handler';
import { resolveEnv } from './env';
import type { Manifest } from './types';

export class Loader {
  private readonly handler: ProjectHandler;

  constructor(handler: ProjectHandler) {
    this.handler = handler;
  }

  getEnv(): Record<string, string> {
    return resolveEnv(this.handler._part, this.handler._path);
  }

  getManifest(): Manifest {
    const entries = directoryContentToFileEntries(
      this.handler._fs.getDirectory(join('.nanoforge', this.handler._part)).read(true),
      this.handler._path,
    );
    return {
      version: '1.0.0',
      files: entries.map((path) => ({ path })),
    };
  }

  getFile(path: string): ReadStream {
    const fullPath = join(
      '.nanoforge',
      this.handler._part,
      `${path.startsWith('/') ? path.slice(1) : path}`,
    );
    return this.handler._fs.getFile(fullPath).readStream();
  }
}
