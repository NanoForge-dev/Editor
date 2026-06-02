import { $ } from 'bun';
import { resolve } from 'path';

import { env } from '$env/dynamic/private';

import { generateKey } from '@utils-server/string';

export class Git {
  private readonly _rootPath: string;

  constructor() {
    this._rootPath = resolve(env.FS_ROOT ?? '');
  }

  async clone(url: string, options?: { sshKey?: string }): Promise<string> {
    const path = await this.resolvePath(url);
    await this.runCommand('clone', `${url} ${path}`, { ...options });
    return path;
  }

  private async runCommand(
    command: string,
    params: string,
    options?: { path?: string; sshKey?: string },
  ) {
    let sshPath = undefined;
    if (options?.sshKey) {
      sshPath = await this.createSshKeyFile(options.sshKey);
    }
    const sshConfig = sshPath ? `-c core.sshCommand="ssh -i ${sshPath}" ` : '';
    const cwd = resolve(this._rootPath, options?.path ?? '');

    await $`git ${command} ${sshConfig}${params}`.cwd(cwd);
    if (sshPath) await this.deleteSshKeyFile(sshPath);
  }

  private async createSshKeyFile(sshKey: string): Promise<string> {
    const path = `/tmp/nanoforge/${generateKey()}`;
    await Bun.file(path).write(sshKey);
    return path;
  }

  private async deleteSshKeyFile(path: string): Promise<void> {
    await Bun.file(path).delete();
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
