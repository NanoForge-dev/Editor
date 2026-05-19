import { env } from '$env/dynamic/private';

import {
  CLI_BUILD_DEFAULTS,
  CLI_CREATE_DEFAULTS,
  CLI_DEV_DEFAULTS,
  CLI_GENERATE_DEFAULTS,
  CLI_INSTALL_DEFAULTS,
  CLI_NEW_DEFAULTS,
  CLI_START_DEFAULTS,
} from '$lib/server/cli/cli-defaults';

import { camelToKebab } from '@utils/format';

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
    return this.runCommand('new', [], { ...CLI_NEW_DEFAULTS, ...opts }, CLI_NEW_DEFAULTS, runOpts);
  }

  install(
    pkgs: [string, ...string[]],
    opts: CliPartial<CliInstallOptions>,
    runOpts?: CliRunOptions,
  ): void {
    this.assertProject();
    return this.runCommand(
      'install',
      pkgs,
      { ...opts, directory: this._projectPath },
      CLI_INSTALL_DEFAULTS,
      runOpts,
    );
  }

  build(opts: CliPartial<CliBuildOptions>, runOpts?: CliRunOptions): void {
    this.assertProject();
    return this.runCommand(
      'build',
      [],
      { ...opts, directory: this._projectPath },
      CLI_BUILD_DEFAULTS,
      runOpts,
    );
  }

  start(opts: CliPartial<CliStartOptions>, runOpts?: CliRunOptions): void {
    this.assertProject();
    return this.runCommand(
      'start',
      [],
      { ...opts, directory: this._projectPath },
      CLI_START_DEFAULTS,
      runOpts,
    );
  }

  dev(opts: CliPartial<CliDevOptions>, runOpts?: CliRunOptions): void {
    this.assertProject();
    return this.runCommand(
      'dev',
      [],
      { ...opts, directory: this._projectPath },
      CLI_DEV_DEFAULTS,
      runOpts,
    );
  }

  generate(opts: CliPartial<CliGenerateOptions>, runOpts?: CliRunOptions): void {
    this.assertProject();
    return this.runCommand(
      'generate',
      [],
      { ...opts, directory: this._projectPath },
      CLI_GENERATE_DEFAULTS,
      runOpts,
    );
  }

  create(
    part: 'component' | 'system',
    opts: CliPartial<CliCreateOptions, 'name'>,
    runOpts?: CliRunOptions,
  ): void {
    this.assertProject();
    return this.runCommand(
      'create',
      [part],
      { ...opts, directory: this._projectPath },
      CLI_CREATE_DEFAULTS,
      runOpts,
    );
  }

  private runCommand(
    command: string,
    params: string[],
    opts: Record<string, string | boolean | undefined>,
    defaultOpts: Record<string, string | boolean | undefined>,
    { async = false }: CliRunOptions = {},
  ): void {
    const fullCommand = [
      env.NF_CLI_PATH ?? 'nf',
      command,
      ...params,
      ...this.resolveParams(opts, defaultOpts),
    ];

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

  private mergeParams(
    ...opts: Record<string, string | boolean | undefined>[]
  ): Record<string, string | boolean | undefined> {
    const merged: Record<string, string | boolean | undefined> = {};
    for (const opt of opts) {
      for (const [key, value] of Object.entries(opt)) {
        if (value === undefined) continue;
        merged[key] = value;
      }
    }
    return merged;
  }

  private resolveParams(
    opts: Record<string, string | boolean | undefined>,
    defaultOpts: Record<string, string | boolean | undefined>,
  ): string[] {
    const params = [];
    for (const [key, value] of Object.entries(this.mergeParams(defaultOpts, opts))) {
      const name = camelToKebab(key);

      if (typeof value === 'boolean') {
        if (value) params.push(`--${name}`);
        else params.push(`--no-${name}`);
      } else {
        params.push(`--${name}`, `${value}`);
      }
    }
    return params;
  }

  private assertProject() {
    if (!this._projectPath) throw new CliError('No project path set');
    if (!Bun.file(this._projectPath).exists()) throw new CliError('Project does not exist');
  }
}
