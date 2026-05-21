import { join } from 'path';

import { loadProject } from '$lib/server/project';
import { loadProjectFromId } from '$lib/server/project/load-project';
import type { SessionProject } from '$lib/server/session';

import { Exception } from '@utils-server/exception';
import { type Handler, useActionHandler } from '@utils-server/request-handler';

class LoadProjectBody {
  id?: string;
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
  const basePath = await git.clone(project.gatewayProjectRegistryUrl, {
    sshKey: project.gatewayProjectRegistryMetadata.sshKey,
  });
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
