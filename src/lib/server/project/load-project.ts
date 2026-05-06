import {
  type SessionProject,
  addProjectToSession,
  getOrCreateSession,
  tryAddProjectSession,
} from '$lib/server/session';

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

  const { fs } = handler;

  const pkg = await fs.getFile('package.json').readJson();

  return {
    id: projectId,
    name: pkg.name,
  };
};
