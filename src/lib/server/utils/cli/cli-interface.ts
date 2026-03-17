import { env } from '$env/dynamic/private';
import { CliError } from '@utils-server/cli/cli-error';
import child_process from 'node:child_process';

export class CliInterface {
  private readonly projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  createProject(
    projectName: string,
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun',
    language: 'js' | 'ts',
    strictTypeChecking: boolean,
    multiplayerServer: boolean,
    skipDependencyInstallation: boolean,
    dockerContainerization: boolean,
  ) {
    this.runCliSync([
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
      skipDependencyInstallation ? '--skip-install' : '--no-skip-install',
      dockerContainerization ? '--docker' : '--no-docker',
    ]);
  }

  startDevProject(pid: number): number {
    if (this.isProjectRunning(pid) && pid != -1) {
      throw new CliError('Project already running');
    }
    this.runCliSync([`build`, `-d`, this.projectPath]);
    return this.runCliAsync([`dev`, `-d`, this.projectPath]);
  }

  stopProject(pid: number) {
    if (!this.isProjectRunning(pid)) {
      throw new CliError('Project not running');
    }
    process.kill(pid, 'SIGTERM');
  }

  isProjectRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private runCliSync(params: string[]) {
    const res = child_process.spawnSync(env.NF_CLI_PATH, params);
    if (res.status === null) {
      throw new CliError(`Executable ${env.NF_CLI_PATH} cannot be found or executed`);
    }
    if (res.status !== 0) {
      console.log(res.stdout.toString());
      console.error(res.stderr.toString());
      throw new CliError(res.stderr.toString());
    }
  }

  private runCliAsync(params: string[]): number {
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
