import { type Session as SvelteSession } from 'svelte-kit-sessions';

import { Exception } from '@utils/exception';
import { generateKey } from '@utils/string';

import { PUBLIC_PATHS } from './session.const';
import { sessionStore } from './session.store';
import type { Session } from './session.type';

export const isPublicPath = (url: URL) => {
  return PUBLIC_PATHS.includes(url.pathname) || url.pathname.startsWith('/actions');
};

export const resolveSession = async (sessionHandler: SvelteSession): Promise<Session | null> => {
  const id = sessionHandler.data.id;

  if (!id) return null;

  if (!sessionStore.has(id)) {
    await resetSession(sessionHandler);
    throw new Exception('Bad Request', 'Invalid session', 400);
  }
  return sessionStore.get(id) as Session;
};

export const resetSession = (sessionHandler: SvelteSession): Promise<void> => {
  return sessionHandler.destroy();
};

export const addProjectToSession = (session: Session, projectId: string): void => {
  if (!sessionStore.has(session.id)) {
    throw new Exception('Bad Request', 'Invalid session', 400);
  }

  sessionStore.set(session.id, {
    ...session,
    projects: [...session.projects, projectId],
  });
};

export const getOrCreateSession = async (sessionHandler: SvelteSession): Promise<Session> => {
  const session = await resolveSession(sessionHandler);
  if (session) return session;

  const id = generateKey(10);
  sessionStore.set(id, { id, projects: [] });
  await sessionHandler.setData({ id });
  await sessionHandler.save();
  return sessionStore.get(id) as Session;
};
