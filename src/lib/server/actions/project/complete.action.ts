import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

import { resolveSessionFunctions } from '$lib/server/actions/project/load.action';
import { loadProject } from '$lib/server/project';

import { useActionHandler } from '@utils-server/request-handler';

export class CompleteProjectBody {
  @Expose()
  @IsUUID(8)
  @IsNotEmpty()
  gatewayId!: string;

  @Expose()
  @IsString()
  @IsOptional()
  @IsEnum(['js', 'ts'])
  language?: 'js' | 'ts';

  @Expose()
  @IsBoolean()
  @IsOptional()
  multiplayerServer?: boolean;
}

export const completeProjectAction = useActionHandler(
  async (handler) => {
    const { body, cli, api } = handler;

    const project = await api.projects.getProject(body.gatewayId);
    const resolver = await resolveSessionFunctions.gatewayId(body.gatewayId, handler);

    const parts = resolver.path.split('/');
    const end = parts.pop();

    cli.new({
      editor: true,
      directory: parts.join('/'),
      name: project.name,
      path: end,
      packageManager: 'bun',
      language: body.language,
      server: body.multiplayerServer,
      docker: false,
      lint: false,
      initFunctions: true,
      strict: false,
      git: false,
    });

    return await loadProject(resolver, handler);
  },
  {
    body: CompleteProjectBody,
    onlineOnly: true,
    projectOptional: true,
  },
);
