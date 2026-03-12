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
    this.runCli([
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

  startProject() {
    this.runCli([`build`, `-d`, this.projectPath]);
    this.runCli([`start`, `-d`, this.projectPath]);
  }

  private runCli(params: string[]) {
    const res = child_process.spawnSync(env.NF_CLI_PATH, params);
    if (res.status === null) {
      throw new CliError(`Executable ${env.NF_CLI_PATH} cannot be found or executed`);
    }
    if (res.status !== 0) {
      throw new CliError(res.stderr.toString());
    }
  }
}
