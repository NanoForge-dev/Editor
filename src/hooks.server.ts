import { env } from '$env/dynamic/private';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import * as crypto from 'node:crypto';
import { sveltekitSessionHandle } from 'svelte-kit-sessions';

declare module 'svelte-kit-sessions' {
  interface SessionData {
    path: string;
  }
}

if (!env.SESSION_SECRET) {
  env.SESSION_SECRET = crypto.randomBytes(20).toString('hex');
  console.log(`SESSION_SECRET not found, generating a temporary one: ${env.SESSION_SECRET}`);
}

const sessionHandle = sveltekitSessionHandle({
  secret: env.SESSION_SECRET,
});

const checkAuthorizationHandle: Handle = async ({ event, resolve }) => {
  if (!event.locals.session.data.path && event.url.pathname !== '/loadProject') {
    throw redirect(302, '/loadProject');
  }
  return resolve(event);
};

const handleParaglide: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;

    return resolve(event, {
      transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale),
    });
  });

export const handle: Handle = sequence(sessionHandle, handleParaglide, checkAuthorizationHandle);
