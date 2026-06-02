import { type Handle, redirect } from '@sveltejs/kit';
import { sveltekitSessionHandle } from 'svelte-kit-sessions';

import { env } from '$env/dynamic/private';

import { generateKey } from '@utils-server/string';

import { isPublicPath, isSessionExist, resetSession } from './session-functions';

export const sessionHandle = sveltekitSessionHandle({
  secret: env.SESSION_SECRET || generateKey(),
});

export const checkAuthorizationHandle: Handle = async ({ event, resolve }) => {
  const sessionData = event.locals.session.data;

  if (isPublicPath(event.url)) return resolve(event);

  if (!isSessionExist(sessionData.id)) {
    await resetSession(event.locals.session);
    throw redirect(302, '/');
  }
  return resolve(event);
};
