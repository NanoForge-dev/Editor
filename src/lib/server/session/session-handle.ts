import { type Handle, redirect } from '@sveltejs/kit';
import { sveltekitSessionHandle } from 'svelte-kit-sessions';

import { env } from '$env/dynamic/private';

import { generateKey } from '@utils/string';

import { isPublicPath } from './session-functions';

export const sessionHandle = sveltekitSessionHandle({
  secret: env.SESSION_SECRET || generateKey(),
});

export const checkAuthorizationHandle: Handle = async ({ event, resolve }) => {
  const sessionData = event.locals.session.data;

  if (isPublicPath(event.url)) return resolve(event);

  if (!sessionData.path) throw redirect(302, '/');
  // Replace line above with it when new session are handled
  // if (!isSessionExist(sessionData.id)) throw redirect(302, '/load-project');
  return resolve(event);
};
