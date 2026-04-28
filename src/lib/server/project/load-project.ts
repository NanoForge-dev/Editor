import {
  type SessionProject,
  addProjectToSession,
  tryAddProjectSession,
} from '$lib/server/session';

import { type Handler } from '@utils-server/request-handler';

import type { Project } from './project.type';

export const loadProject = async (session: SessionProject, handler: Handler): Promise<Project> => {
  // @todo add getOrCreateSession(handler.event.locals.session) and remove id from session
  const projectId = tryAddProjectSession(session);
  addProjectToSession(handler.context.session, projectId);

  handler.context = { ...handler.context, project: session };

  const { fs } = handler;

  const pkg = await fs.getFile('package.json').readJson();

  return {
    id: projectId,
    name: pkg.name,
  };
};
