import micromatch from 'micromatch';
import { join } from 'path';
import * as tar from 'tar';

import { Exception } from '@utils/exception';

import type { Context, Handler } from '@utils-server/request-handler';

import { resolveArchiveRootPath } from './file-system.functions';
import { directoryContentToFileEntries } from './project-directory';

interface Archive {
  path: string;
  sessionId: string;
}

const archives = new Map<string, Archive>();

export class ArchiveSystem {
  private readonly handler: Handler;
  private readonly context: Context;
  private readonly _rootPath: string;
  private readonly _sessionId: string;

  constructor(handler: Handler, context: Context) {
    this.handler = handler;
    this.context = context;
    this._sessionId = context.session.id;
    this._rootPath = resolveArchiveRootPath();
  }

  async create(ignoreFile: string = '.gitignore'): Promise<string> {
    const dir = this.handler.fs.getDirectory('');

    let files = directoryContentToFileEntries(dir.read(true)).map((n) =>
      n.startsWith('/') ? n.slice(1) : n,
    );
    try {
      const ignore = await Bun.file(join(dir.path, ignoreFile)).text();
      files = micromatch.not(files, ignore.split('\n').filter(Boolean), {
        dot: true,
        contains: true,
      });
    } catch (e) {
      console.warn(`Could not read ${ignoreFile} file`, e);
    }

    const id = `${this._resolveId()}.tgz`;

    const path = join(this._rootPath, id);

    await tar.c(
      {
        gzip: true,
        file: path,
        cwd: dir.path,
      },
      files,
    );

    archives.set(id, { sessionId: this._sessionId, path });
    setTimeout(this._delete.bind(this, id), 1000 * 60 * 15);
    return id;
  }

  async get(id: string): Promise<Bun.BunFile> {
    const archive = archives.get(id);
    if (!archive) throw new Exception('Not Found', 'Archive not found', 404);
    if (archive.sessionId !== this._sessionId)
      throw new Exception('Forbidden', 'Archive is not yours', 403);

    return Bun.file(archive.path);
  }
  private async _delete(id: string): Promise<void> {
    const archive = archives.get(id);
    if (!archive) return;
    try {
      await Bun.file(archive.path).delete();
      archives.delete(id);
    } catch (e) {
      console.error('Could not delete archive', e);
    }
  }

  private _resolveId(): string {
    return `${this.context.project.path.split('/').pop() ?? 'unknown'}-${new Date().toISOString()}`;
  }
}
