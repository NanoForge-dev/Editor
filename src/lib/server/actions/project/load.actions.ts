import { join } from 'path';

import { loadProject } from '$lib/server/project';
import type { SessionProject } from '$lib/server/session';

import { Exception } from '@utils-server/exception';
import { type Handler, useRequestHandler } from '@utils-server/request-handler';

class LoadProjectBody {
  path?: string;
  gitUrl?: string;
  gatewayId?: string;
}

const resolveSessionFromGatewayId = async (
  gatewayId: string,
  { api, git, context }: Handler,
): Promise<SessionProject> => {
  if (!context.online)
    throw new Exception('Bad Request', 'Cannot load project from gatewayId while offline', 400);

  const project = await api.projects.getProject(gatewayId);
  const basePath = await git.clone(
    project.gatewayProjectRegistryUrl,
    project.gatewayProjectRegistryMetadata.sshKey,
  );
  return {
    path: join(basePath, project.gatewayProjectRegistryMetadata.dir ?? ''),
    gateway: { id: gatewayId, sshKey: project.gatewayProjectRegistryMetadata.sshKey },
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

const resolveSessionFunctions: Record<
  keyof LoadProjectBody,
  (el: string, options: Handler) => Promise<SessionProject>
> = {
  path: resolveSessionFromPath,
  gitUrl: resolveSessionFromGitUrl,
  gatewayId: resolveSessionFromGatewayId,
};

export const loadProjectAction = useRequestHandler(
  async (handler) => {
    const { body } = handler;

    const el = Object.entries(body).find(([, value]) => value) as [keyof LoadProjectBody, string];
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
