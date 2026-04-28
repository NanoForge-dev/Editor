import child_process from 'node:child_process';

import { env } from '$env/dynamic/private';

import { CliError } from '@utils-server/cli/cli-error';

export class CliInterface {
  private readonly projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  new(
    projectName: string,
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun',
    language: 'js' | 'ts',
    strictTypeChecking?: boolean,
    multiplayerServer?: boolean,
    dockerContainerization?: boolean,
    generateLintFiles?: boolean,
    editor?: boolean,
    createGitRepository?: boolean,
    gitRemote?: string,
  ) {
    this._runCliSync([
      `new`,
      `-d`,
      this.projectPath,
      `--name`,
      projectName,
      `--package-manager`,
      packageManager,
      `--language`,
      language,
      strictTypeChecking ? '--strict' : '--no-strict',
      multiplayerServer ? '--server' : '--no-server',
      '--init-functions',
      '--no-skip-install',
      dockerContainerization ? '--docker' : '--no-docker',
      generateLintFiles ? undefined : '--no-lint',
      editor ? '--editor' : undefined,
      createGitRepository ? '--git' : '--no-git',
      gitRemote ? '--git-remote' : '--no-git-remote',
      gitRemote,
    ]);
  }

  build(editor?: boolean) {
    this._runCliSync(['build', `-d`, this.projectPath, editor ? '--editor' : undefined]);
  }

  generate(editor?: boolean) {
    this._runCliSync(['generate', `-d`, this.projectPath, editor ? '--editor' : undefined]);
  }

  addComponent(componentName: string) {
    this._runCliSync(['add', `-d`, this.projectPath, componentName]);
  }

  private _runCliSync(params: (string | undefined)[]) {
    const res = child_process.spawnSync(
      env.NF_CLI_PATH,
      params.filter((e) => e !== undefined),
    );
    if (res.status === null) {
      throw new CliError(`Executable ${env.NF_CLI_PATH} cannot be found or executed`);
    }
    if (res.status !== 0) {
      console.log(res.stdout.toString());
      console.error(res.stderr.toString());
      throw new CliError(res.stderr.toString());
    }
  }

  private _runCliAsync(params: string[]): number {
    const res = child_process.spawn(env.NF_CLI_PATH, params);

    const startTime = Date.now();
    while (res.pid === undefined && Date.now() - startTime < 100) {
      /* if I remove this comment the linter is crying */
    }
    if (res.pid === undefined) {
      throw new CliError('Failed to start process: pid not available');
    }

    res.on('error', () => {
      throw new CliError(res.stderr.toString());
    });
    res.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.log(res.stdout.read()?.toString());
        console.log(res.stderr.read()?.toString());
        throw new CliError(`Process exited with code ${code}`);
      }
    });
    return res.pid;
  }
}
