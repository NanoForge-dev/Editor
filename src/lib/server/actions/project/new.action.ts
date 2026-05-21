import { resolve } from 'path';

import { loadProject } from '$lib/server/project';

import { useActionHandler } from '@utils-server/request-handler';

class CreateProjectBody {
  projectName!: string;

  projectPath?: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  language?: 'js' | 'ts';
  multiplayerServer?: boolean;
  dockerContainerization?: boolean;
  createGitRepository?: boolean;
  gitRemote?: string | false;
}

export const createProjectAction = useActionHandler(
  async (handler) => {
    const { body, cli } = handler;

    cli.new({
      editor: true,
      directory: body.projectPath || undefined,
      name: body.projectName,
      path: body.projectName,
      packageManager: body.packageManager,
      language: body.language,
      server: body.multiplayerServer,
      docker: body.dockerContainerization,
      git: body.createGitRepository,
      gitRemote: body.gitRemote,
    });

    return await loadProject({ path: resolve(body.projectPath ?? '', body.projectName) }, handler);
  },
  {
    body: CreateProjectBody,
    offlineOnly: true,
    projectOptional: true,
  },
);
