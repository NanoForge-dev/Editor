import { authStore } from '../../../stores/auth.store';
import type { MiddlewareNext, MiddlewareParams } from '../../../utils/http-client';

let accessToken: string | null = null;

authStore.subscribe((auth) => {
  accessToken = auth.accessToken;
});

export const AuthMiddleware = async (params: MiddlewareParams, next: MiddlewareNext) => {
  if (accessToken) {
    params.options.headers = {
      ...params.options.headers,
      Authorization: `Bearer ${accessToken}`,
    };
  }
  return next(params);
};
