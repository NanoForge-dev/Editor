import type { RequestEvent } from '@sveltejs/kit';

import { PUBLIC_MODE } from '$env/static/public';

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
    online: PUBLIC_MODE === 'ONLINE',
    session,
    project,
  };
};
