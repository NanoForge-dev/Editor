import type { Cookies } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';

import type { TokenResponse } from '$lib/server/api/types/auth.type';

export const setTokensInCookies = (
  cookies: Cookies,
  { accessToken, refreshToken, tokenExpiresAt }: TokenResponse,
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
