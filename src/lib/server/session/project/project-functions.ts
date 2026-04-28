import { generateKey } from '@utils/string';

import type { Session } from '../session.type';
import { SESSION_PROJECT_HEADER } from './project.const';
import { projectStore } from './project.store';
import type { SessionProject } from './project.type';

export const isProjectExist = (id: string | null | undefined) => {
  if (!id) return false;
  if (!projectStore.has(id)) return false;

  return true;
};

export const hasRightToAccessProject = (id: string | null | undefined, session: Session) => {
  if (!isProjectExist(id)) return false;
  if (!session.projects.includes(id as string)) return false;

  return true;
};

export const resolveProject = (headers: Headers, session: Session) => {
  if (!session) return null;
  if (!session.projects.length) return null;
  const id = headers.get(SESSION_PROJECT_HEADER);

  if (!hasRightToAccessProject(id, session)) return null;

  return projectStore.get(id as string) ?? null;
};

export const tryAddProjectSession = (session: SessionProject): string => {
  let id = generateKey(10);
  while (projectStore.has(id)) id = generateKey(10);
  projectStore.set(id, session);
  return id;
};
