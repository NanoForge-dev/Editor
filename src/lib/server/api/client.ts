import type { Cookies } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';

import { HttpClient } from '@utils/http';

import { useTokenMiddleware } from './middlewares/refresh-token.middleware';
import { AuthRepository } from './repositories/auth.repository';
import { ProjectRepository } from './repositories/projects.repository';
import { RegistryRepository } from './repositories/registry.repository';

export interface Api {
  auth: AuthRepository;
  projects?: ProjectRepository;
  registry: RegistryRepository;
}

export const getNoAuthApi = (): Api => {
  const client = new HttpClient(env.API_URL || 'https://api.nanoforge.eu', {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': env.API_KEY,
    },
  });
  const isOnline = env.PUBLIC_MODE === 'ONLINE';

  return {
    auth: new AuthRepository(client, isOnline),
    registry: new RegistryRepository(client, isOnline),
  };
};

export const getApi = (cookies: Cookies): Api => {
  if (env.PUBLIC_MODE !== 'ONLINE') throw new Error('API is only available in online mode');
  if (!env.API_URL) throw new Error('API_URL is not defined');
  if (!env.API_KEY) throw new Error('API_KEY is not defined');

  const client = new HttpClient(env.API_URL, {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': env.API_KEY,
    },
  }).useMiddlewares(useTokenMiddleware(cookies));
  return {
    auth: new AuthRepository(client),
    projects: new ProjectRepository(client),
    registry: new RegistryRepository(client),
  };
};
