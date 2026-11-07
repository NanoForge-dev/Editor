import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { Emitter, type Event } from '@nanoforge-dev/editor-kernel';

import type { EditorEnv } from '../env/editor-env.type';
import { type OutputLine, type ProcessResult, runProcess } from './run-process';

export interface CliRun {
  readonly id: string;
  /** What ran, as shown in the console: `nf`, or a package manager. */
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  /** The caller reports the output itself (builds): not shown as a task in the console. */
  readonly silent: boolean;
  readonly onLine: Event<OutputLine>;
  readonly done: Promise<ProcessResult>;
  kill(): void;
}

/** Runs the NanoForge CLI (`nf`), preferring the project's own installation. */
export class CliService {
  private readonly _onDidStart = new Emitter<CliRun>();
  private _counter = 0;

  /** Fires for every run: runs in a project are streamed to its console as tasks. */
  readonly onDidStart: Event<CliRun> = this._onDidStart.event;

  constructor(private readonly _env: EditorEnv) {}

  /** `node_modules/.bin/nf` of the closest ancestor of `cwd`, else `NF_CLI_PATH` or `nf`. */
  resolveBinary(cwd: string): string {
    if (this._env.cliPath) return this._env.cliPath;
    for (let dir = cwd; ; dir = dirname(dir)) {
      const candidate = join(
        dir,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'nf.cmd' : 'nf',
      );
      if (existsSync(candidate)) return candidate;
      if (dirname(dir) === dir) return 'nf';
    }
  }

  run(
    args: readonly string[],
    options: {
      cwd: string;
      env?: Record<string, string>;
      signal?: AbortSignal;
      silent?: boolean;
    },
  ): CliRun {
    return this._start('nf', this.resolveBinary(options.cwd), args, options);
  }

  /** Runs another tool of the project (its package manager), reported like a CLI run. */
  exec(
    command: string,
    args: readonly string[],
    options: { cwd: string; env?: Record<string, string>; signal?: AbortSignal },
  ): CliRun {
    return this._start(command, command, args, options);
  }

  private _start(
    command: string,
    binary: string,
    args: readonly string[],
    options: {
      cwd: string;
      env?: Record<string, string>;
      signal?: AbortSignal;
      silent?: boolean;
    },
  ): CliRun {
    const { silent = false, ...processOptions } = options;
    const process = runProcess(binary, args, processOptions);
    const run: CliRun = {
      id: `cli-${++this._counter}`,
      command,
      args,
      cwd: options.cwd,
      silent,
      ...process,
    };
    this._onDidStart.fire(run);
    return run;
  }
}
