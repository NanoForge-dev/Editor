import { timingSafeEqual } from 'node:crypto';

import { parseCookies, serializeCookie } from '../session/cookies';

const LAUNCH_TOKEN_COOKIE = 'nf_editor_token';
const PARAM = 'token';

const same = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** The editor's link with its token: what a local editor started with `EDITOR_TOKEN` prints. */
export const linkWithToken = (base: string, token: string): string => {
  const url = new URL(base);
  url.searchParams.set(PARAM, token);
  return url.href;
};

/**
 * Checks a request against the launch token (`EDITOR_TOKEN`). A request with the token cookie
 * passes (undefined). A link with the token sets the cookie and goes to the same page without it;
 * anything else is refused, a page saying which link to open.
 */
export const launchTokenCheck = (token: string, request: Request): Response | undefined => {
  const cookie = parseCookies(request.headers.get('cookie'))[LAUNCH_TOKEN_COOKIE];
  if (cookie && same(cookie, token)) return undefined;
  const url = new URL(request.url);
  const given = url.searchParams.get(PARAM);
  if (given && same(given, token) && request.method === 'GET') {
    url.searchParams.delete(PARAM);
    return new Response(null, {
      status: 303,
      headers: {
        location: `${url.pathname}${url.search}`,
        'set-cookie': serializeCookie(LAUNCH_TOKEN_COOKIE, token, { sameSite: 'Strict' }),
        'cache-control': 'no-store',
      },
    });
  }
  const page = (request.headers.get('accept') ?? '').includes('text/html');
  return page
    ? new Response(
        '<!doctype html><meta charset="utf-8"><title>NanoForge editor</title><p>This editor asks for its link: open the one it printed when it started (it ends with <code>?token=…</code>).</p>',
        {
          status: 401,
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
        },
      )
    : new Response(JSON.stringify({ error: 'Open the link the editor printed when it started' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
};
