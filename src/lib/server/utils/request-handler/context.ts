import type { RequestEvent } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';

import {
  type Session,
  type SessionProject,
  resolveProject,
  resolveSession,
} from '$lib/server/session';

export interface Context {
  online: boolean;
  session: Session;
  project: SessionProject;
}

export const getContext = async (event: RequestEvent): Promise<Context> => {
  const session = (await resolveSession(event.locals.session)) as Session;
  const project = resolveProject(event.request.headers, session) as SessionProject;

  return {
    online: env.MODE === 'ONLINE',
    session,
    project,
  };
};
