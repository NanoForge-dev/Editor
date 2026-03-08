import { type Cookies, json } from '@sveltejs/kit';

import { serverApi, withAuth } from '../clients';
import type { Repository } from '../index';
import type { RefreshTokenInput, Token } from '../types';
import { setTokensInCookies } from '../utils';
import { errorGuard } from './error.guard';

export const authGuard = async (
  callback: (httpClient: Repository) => Promise<Response>,
  cookies: Cookies,
): Promise<Response> => {
  return errorGuard(async () => {
    let accessToken = cookies.get('accessToken');

    if (!accessToken) {
      const refreshToken = cookies.get('refreshToken');

      if (!refreshToken) {
        return json({ error: 'Unauthorized', message: 'No token found' }, { status: 401 });
      }

      try {
        const tokens = await serverApi.post<Token, RefreshTokenInput>('/auth/refresh-token', {
          refreshToken,
        });

        setTokensInCookies(cookies, tokens);
        accessToken = tokens.accessToken;
      } catch {
        return json({ error: 'Unauthorized', message: 'Invalid refresh token' }, { status: 401 });
      }
    }

    return callback(withAuth(accessToken));
  });
};
