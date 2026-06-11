import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { join } from 'path';

import { Git } from '$lib/server/git';
import { loadProject } from '$lib/server/project';
import { loadProjectFromId } from '$lib/server/project/load-project';
import type { SessionProject } from '$lib/server/session';

import { Exception } from '@utils/exception';

import { type Handler, useActionHandler } from '@utils-server/request-handler';

export class LoadProjectBody {
  @Expose()
  @IsString()
  @IsOptional()
  id?: string;

  @Expose()
  @IsString()
  @IsOptional()
  path?: string;

  @Expose()
  @IsString()
  @IsOptional()
  gitUrl?: string;

  @Expose()
  @IsString()
  @IsOptional()
  gatewayId?: string;
}

const resolveSessionFromGatewayId = async (
  gatewayId: string,
  { api, context }: Handler,
): Promise<SessionProject> => {
  if (!context.online)
    throw new Exception('Bad Request', 'Cannot load project from gatewayId while offline', 400);

  const project = await api.projects.getProject(gatewayId);

  const git = new Git({
    ...context,
    project: { path: '', gateway: { id: gatewayId, token: project.token } },
  });
  const basePath = await git.clone(project.gatewayProjectRegistryUrl);
  return {
    path: join(basePath, project.gatewayProjectRegistryMetadata.dir ?? ''),
    gateway: { id: gatewayId, token: project.token },
  };
};

const resolveSessionFromGitUrl = async (
  gitUrl: string,
  { git, context }: Handler,
): Promise<SessionProject> => {
  if (context.online)
    throw new Exception('Bad Request', 'Cannot load project from gitUrl while online', 400);

  const path = await git.clone(gitUrl);
  return { path };
};

const resolveSessionFromPath = async (
  path: string,
  { context }: Handler,
): Promise<SessionProject> => {
  if (context.online)
    throw new Exception('Bad Request', 'Cannot load project from path while online', 400);
  return { path };
};

export const resolveSessionFunctions: Record<
  keyof Omit<LoadProjectBody, 'id'>,
  (el: string, options: Handler) => Promise<SessionProject>
> = {
  path: resolveSessionFromPath,
  gitUrl: resolveSessionFromGitUrl,
  gatewayId: resolveSessionFromGatewayId,
};

export const loadProjectAction = useActionHandler(
  async (handler) => {
    const { body } = handler;

    if (body.id) return await loadProjectFromId(body.id, handler);

    const el = Object.entries(body).find(([, value]) => value) as [
      keyof Omit<LoadProjectBody, 'id'>,
      string,
    ];
    if (!el) throw new Exception('Bad Request', 'No load origin provided', 400);

    const resolveSessionFunction = resolveSessionFunctions[el[0]];

    const project = await resolveSessionFunction(el[1], handler);

    return await loadProject(project, handler);
  },
  {
    projectOptional: true,
    body: LoadProjectBody,
  },
);
