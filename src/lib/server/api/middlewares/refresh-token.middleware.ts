import type { Cookies } from '@sveltejs/kit';

import { getNoAuthApi } from '$lib/server/api/client';

import type { MiddlewareNext, MiddlewareParams } from '@utils/http';

import { setTokensInCookies } from '@utils-server/cookies';
import { Exception } from '@utils-server/exception';

const refreshToken = async (cookies: Cookies, force: boolean = false): Promise<string> => {
  let accessToken = force ? undefined : cookies.get('accessToken');
  const refreshToken = cookies.get('refreshToken');

  if (!accessToken) {
    if (!refreshToken) {
      throw new Exception('Unauthorized', 'No token found', 401);
    }

    try {
      const tokens = await getNoAuthApi().auth.refreshToken({
        refreshToken,
      });

      setTokensInCookies(cookies, tokens);
      accessToken = tokens.accessToken;
    } catch {
      throw new Exception('Unauthorized', 'Invalid refresh token', 401);
    }
  }

  return accessToken;
};

const getRequestParams = (params: MiddlewareParams, token: string): MiddlewareParams => ({
  ...params,
  options: {
    ...params.options,
    headers: {
      ...params.options.headers,
      Authorization: `Bearer ${token}`,
    },
  },
});

export const useTokenMiddleware = (cookies: Cookies) => {
  return async (params: MiddlewareParams, next: MiddlewareNext) => {
    const accessToken = cookies.get('accessToken') ?? (await refreshToken(cookies));

    const res = await next(getRequestParams(params, accessToken));

    if (res.status === 401) {
      const newAccessToken = await refreshToken(cookies, true);
      return await next(getRequestParams(params, newAccessToken));
    }
    return res;
  };
};
