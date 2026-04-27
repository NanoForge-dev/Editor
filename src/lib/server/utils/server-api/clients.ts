import { env } from '$env/dynamic/private';

import { HttpClient } from '@utils/http';

import { Repository } from './repository';

const client = new HttpClient(env.API_URL ?? '');

export const serverApi = new Repository(client);

export const withAuth = (token: string) => {
  return new Repository(
    new HttpClient(env.API_URL ?? '', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }),
  );
};
