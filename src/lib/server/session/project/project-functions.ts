import { SESSION_PROJECT_HEADER } from '@utils/const';
import { generateKey } from '@utils/string';

import type { Session } from '../session.type';
import { projectStore } from './project.store';
import type { SessionProject } from './project.type';

export const projectExists = (id: string | null | undefined) => {
  return !!id && projectStore.has(id);
};

export const hasRightToAccessProject = (id: string | null | undefined, session: Session) => {
  return projectExists(id) && session.projects.includes(id as string);
};

export const resolveProject = (headers: Headers, session: Session) => {
  if (!session) return null;
  if (!session.projects.length) return null;
  const id = headers.get(SESSION_PROJECT_HEADER);

  return getProject(id, session);
};

export const getProject = (id: string | null, session: Session) => {
  if (!hasRightToAccessProject(id, session)) return null;

  return projectStore.get(id as string) ?? null;
};

export const tryAddProjectSession = (session: SessionProject): string => {
  let id = generateKey(10);
  while (projectStore.has(id)) id = generateKey(10);
  projectStore.set(id, session);
  return id;
};
