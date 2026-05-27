import {
  type SessionProject,
  addProjectToSession,
  getOrCreateSession,
  tryAddProjectSession,
} from '$lib/server/session';
import { getProject } from '$lib/server/session/project/project-functions';

import { Exception } from '@utils/exception';

import { type Handler } from '@utils-server/request-handler';

import type { Project } from './project.type';

export const loadProject = async (
  projectSession: SessionProject,
  handler: Handler,
): Promise<Project> => {
  // @todo remake this route and session system as it's set before the project is loaded

  const session = await getOrCreateSession(handler.event.locals.session);
  const projectId = tryAddProjectSession(projectSession);
  addProjectToSession(session, projectId);

  handler.context = { ...handler.context, project: projectSession };

  return {
    id: projectId,
    cacheResolvable: handler.context.online
      ? (projectSession.gateway?.id as string)
      : projectSession.path,
  };
};

export const loadProjectFromId = async (id: string, handler: Handler): Promise<Project> => {
  // @todo remake this route and session system as it's set before the project is loaded

  const session = await getOrCreateSession(handler.event.locals.session);
  const projectSession = getProject(id, session);

  if (!projectSession) throw new Exception('Bad Request', 'Project not found', 400);

  addProjectToSession(session, id);

  handler.context = { ...handler.context, project: projectSession };

  return {
    id,
    cacheResolvable: handler.context.online
      ? (projectSession.gateway?.id as string)
      : projectSession.path,
  };
};
