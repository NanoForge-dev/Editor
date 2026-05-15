import type { Cookies } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';

import { HttpClient } from '@utils/http';

import type { Context } from '@utils-server/request-handler/context';

import { useTokenMiddleware } from './middlewares/refresh-token.middleware';
import { AuthRepository } from './repositories/auth.repository';
import { ProjectRepository } from './repositories/projects.repository';
import { RegistryRepository } from './repositories/registry.repository';

export interface Api {
  auth: AuthRepository;
  projects: ProjectRepository;
  registry: RegistryRepository;
}

export const getNoAuthApi = () => {
  if (env.PUBLIC_MODE !== 'ONLINE') throw new Error('API is only available in online mode');
  if (!env.API_URL) throw new Error('API_URL is not defined');
  if (!env.API_KEY) throw new Error('API_KEY is not defined');

  const client = new HttpClient(env.API_URL, {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': env.API_KEY,
    },
  });
  return { auth: new AuthRepository(client, true) };
};

export const getApi = (context: Context, cookies: Cookies): Api => {
  if (!env.API_URL) throw new Error('API_URL is not defined');
  if (!env.API_KEY) throw new Error('API_KEY is not defined');

  const client = new HttpClient(env.API_URL, {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': env.API_KEY,
    },
  }).useMiddlewares(useTokenMiddleware(cookies));
  return {
    auth: new AuthRepository(client, context.online),
    projects: new ProjectRepository(client, context.online),
    registry: new RegistryRepository(client, context.online),
  };
};
