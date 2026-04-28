import type { SessionProject } from '$lib/server/session';
import { tryAddProjectSession } from '$lib/server/session/project/project-functions';
import { addProjectToSession } from '$lib/server/session/session-functions';

import { type Handler } from '@utils-server/request-handler';

import type { Project } from './project.type';

export const loadProject = async (session: SessionProject, handler: Handler): Promise<Project> => {
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
