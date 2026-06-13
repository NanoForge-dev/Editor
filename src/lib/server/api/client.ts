import type { Cookies } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';
import { PUBLIC_MODE } from '$env/static/public';

import { HttpClient } from '@utils/http';

import { useTokenMiddleware } from './middlewares/refresh-token.middleware';
import { AuthRepository } from './repositories/auth.repository';
import { PackageRepository } from './repositories/package.repository';
import { ProjectRepository } from './repositories/projects.repository';
import { RegistryRepository } from './repositories/registry.repository';

export interface Api {
  auth: AuthRepository;
  packages: PackageRepository;
  projects: ProjectRepository;
  registry: RegistryRepository;
}

const DEFAULT_API_URL = 'https://api.nanoforge.eu';

export const getNoAuthApi = (): Api => {
  const client = new HttpClient(env.API_URL ?? DEFAULT_API_URL, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const isOnline = PUBLIC_MODE === 'ONLINE';

  return {
    auth: new AuthRepository(client, isOnline),
    packages: new PackageRepository(client, isOnline),
    registry: new RegistryRepository(client, isOnline),
  } as Api;
};

export const getApi = (cookies: Cookies): Api => {
  if (PUBLIC_MODE !== 'ONLINE') throw new Error('API is only available in online mode');
  if (!env.API_KEY) throw new Error('API_KEY is not defined');
  const client = new HttpClient(env.API_URL ?? DEFAULT_API_URL, {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': env.API_KEY,
    },
  }).useMiddlewares(useTokenMiddleware(cookies));
  return {
    auth: new AuthRepository(client),
    packages: new PackageRepository(client),
    projects: new ProjectRepository(client),
    registry: new RegistryRepository(client),
  };
};
