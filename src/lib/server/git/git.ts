import { $ } from 'bun';
import { existsSync } from 'fs';
import { resolve } from 'path';

import { env } from '$env/dynamic/private';

import type { Context } from '@utils-server/request-handler';
import { generateKey } from '@utils-server/string';

export class Git {
  private readonly _rootPath: string;
  private readonly _token: string | null;
  private readonly _path: string;

  constructor(context: Context) {
    this._rootPath = resolve(env.FS_ROOT ?? '');
    this._token = context.project.gateway?.token ?? null;
    this._path = context.project.path;
  }

  async clone(url: string): Promise<string> {
    const path = await this.resolvePath(url);
    if (existsSync(path)) return path;
    if (this._token)
      url = url.replace('https://github.com/', `https://oauth2:${this._token}@github.com/`);
    await this.runCommand('clone', [url, path]);
    return path;
  }

  async push() {
    await this.runCommand('add', ['--all'], { path: this._path });
    const res = await this.runCommand('status', [], { path: this._path });
    if (res.stdout.includes('nothing to commit')) return;
    await this.runCommand('commit', ['-m', `nanoforged at ${new Date().toISOString()}`], {
      path: this._path,
    });
    await this.runCommand('push', ['-u', 'origin', 'main'], { path: this._path });
  }

  private runCommand(command: string, params: string[], options?: { path?: string }) {
    const cwd = resolve(this._rootPath, options?.path ?? '');

    return $`git ${command} ${params}`.cwd(cwd).env({ ...process.env });
  }

  private async resolvePath(url: string) {
    const basePath = url.split('/').pop()?.replace('.git', '');
    if (!basePath) throw new Error('Invalid URL');

    const fullBasePath = resolve(this._rootPath, basePath);
    let path = fullBasePath;

    while (await Bun.file(path).exists()) path = resolve(fullBasePath, generateKey(5));
    return path;
  }
}
