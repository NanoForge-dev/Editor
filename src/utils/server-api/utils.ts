import { env } from '$env/dynamic/private';
import type { Cookies, RequestEvent } from '@sveltejs/kit';

import type { Token } from './types';

export const setTokensInCookies = (
  cookies: Cookies,
  { accessToken, refreshToken, tokenExpiresAt }: Token,
) => {
  cookies.set('accessToken', accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(tokenExpiresAt),
  });

  cookies.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
};

export const resetTokensInCookies = (event: RequestEvent) => {
  const { cookies } = event;

  cookies.delete('accessToken', { path: '/' });
  cookies.delete('refreshToken', { path: '/' });
};
