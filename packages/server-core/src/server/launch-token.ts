import { timingSafeEqual } from 'node:crypto';

import { parseCookies, serializeCookie } from '../session/cookies';

/**
 * Cookies are shared by every port of a host: the name carries the port, so editors on other
 * ports of this machine don't overwrite each other's token (they still receive it).
 */
const cookieName = (url: URL) =>
  `nf_editor_token_${url.port || (url.protocol === 'https:' ? '443' : '80')}`;
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
  const url = new URL(request.url);
  const name = cookieName(url);
  const cookie = parseCookies(request.headers.get('cookie'))[name];
  if (cookie && same(cookie, token)) return undefined;
  const given = url.searchParams.get(PARAM);
  if (given && same(given, token) && request.method === 'GET') {
    url.searchParams.delete(PARAM);
    return new Response(null, {
      status: 303,
      headers: {
        location: `${url.pathname}${url.search}`,
        'set-cookie': serializeCookie(name, token, { sameSite: 'Strict' }),
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
