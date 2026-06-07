import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { join } from 'path';

import { loadProject } from '$lib/server/project';

import { useActionHandler } from '@utils-server/request-handler';
import { IsFalseOrString } from '@utils-server/validators';

export class CreateProjectBody {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  projectName!: string;

  @Expose()
  @IsString()
  @IsOptional()
  projectPath?: string;

  @Expose()
  @IsString()
  @IsOptional()
  @IsEnum(['npm', 'pnpm', 'yarn', 'bun'])
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';

  @Expose()
  @IsString()
  @IsOptional()
  @IsEnum(['js', 'ts'])
  language?: 'js' | 'ts';

  @Expose()
  @IsBoolean()
  @IsOptional()
  multiplayerServer?: boolean;

  @Expose()
  @IsBoolean()
  @IsOptional()
  dockerContainerization?: boolean;

  @Expose()
  @IsBoolean()
  @IsOptional()
  createGitRepository?: boolean;

  @Expose()
  @IsFalseOrString()
  @IsOptional()
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
      lint: false,
    });

    return await loadProject({ path: join(body.projectPath ?? '', body.projectName) }, handler);
  },
  {
    body: CreateProjectBody,
    offlineOnly: true,
    projectOptional: true,
  },
);
