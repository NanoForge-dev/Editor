import { env } from '$env/dynamic/private';

import { camelToKebab } from '@utils/string';

import type { Context } from '@utils-server/request-handler';

import { CliError } from './cli-error';
import type {
  CliBuildOptions,
  CliCreateOptions,
  CliDevOptions,
  CliGenerateOptions,
  CliInstallOptions,
  CliNewOptions,
  CliPartial,
  CliRunOptions,
  CliStartOptions,
} from './cli.type';

export class Cli {
  private readonly _projectPath?: string;

  constructor(context: Context) {
    this._projectPath = context.project?.path;
  }

  new(opts: CliPartial<CliNewOptions, 'name' | 'directory'>, runOpts?: CliRunOptions): void {
    return this.runCommand('new', [], opts, runOpts);
  }

  install(
    pkgs: [string, ...string[]],
    opts: CliPartial<CliInstallOptions>,
    runOpts?: CliRunOptions,
  ): void {
    this.assertProject();
    return this.runCommand('install', pkgs, { ...opts, directory: this._projectPath }, runOpts);
  }

  build(opts: CliPartial<CliBuildOptions>, runOpts?: CliRunOptions): void {
    this.assertProject();
    return this.runCommand('build', [], { ...opts, directory: this._projectPath }, runOpts);
  }

  start(opts: CliPartial<CliStartOptions>, runOpts?: CliRunOptions): void {
    this.assertProject();
    return this.runCommand('start', [], { ...opts, directory: this._projectPath }, runOpts);
  }

  dev(opts: CliPartial<CliDevOptions>, runOpts?: CliRunOptions): void {
    this.assertProject();
    return this.runCommand('dev', [], { ...opts, directory: this._projectPath }, runOpts);
  }

  generate(opts: CliPartial<CliGenerateOptions>, runOpts?: CliRunOptions): void {
    return this.runCommand('generate', [], { ...opts, directory: this._projectPath }, runOpts);
  }

  create(
    part: 'component' | 'system',
    opts: CliPartial<CliCreateOptions, 'name'>,
    runOpts?: CliRunOptions,
  ): void {
    this.assertProject();
    return this.runCommand('create', [part], { ...opts, directory: this._projectPath }, runOpts);
  }

  private runCommand(
    command: string,
    params: string[],
    opts: Record<string, string | boolean | undefined>,
    { async = false }: CliRunOptions = {},
  ): void {
    const fullCommand = [env.NF_CLI_PATH ?? 'nf', command, ...params, ...this.resolveParams(opts)];

    if (async) {
      const res = Bun.spawn(fullCommand, { stdout: 'pipe', stderr: 'pipe' });
      res.exited.then((exitCode) => {
        if (exitCode !== 0) {
          console.log(res.stdout.toString());
          console.error(res.stderr.toString());
          throw new CliError(res.stderr.toString());
        }
      });
    } else {
      const res = Bun.spawnSync(fullCommand, { stdout: 'pipe', stderr: 'pipe' });

      if (res.exitCode !== 0) {
        console.log(res.stdout.toString());
        console.error(res.stderr.toString());
        throw new CliError(res.stderr.toString());
      }
    }
  }

  private resolveParams(opts: Record<string, string | boolean | undefined>): string[] {
    const params = [];
    for (const [key, value] of Object.entries(opts)) {
      if (value === undefined) continue;

      const name = camelToKebab(key);

      if (typeof value === 'boolean') {
        if (value) params.push(`--${name}`);
        else params.push(`--no-${name}`);
      } else {
        params.push(`--${name}`, `'${value}'`);
      }
    }
    return params;
  }

  private assertProject() {
    if (!this._projectPath) throw new CliError('No project path set');
    if (!Bun.file(this._projectPath).exists()) throw new CliError('Project does not exist');
  }
}
