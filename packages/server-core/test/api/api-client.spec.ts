import { describe, expect, it } from 'vitest';

import { ApiClient } from '../../src/api/api-client';
import { loadEnv } from '../../src/env/load-env';

const env = loadEnv({
  NODE_ENV: 'test',
  PUBLIC_MODE: 'ONLINE',
  API_KEY: 'test-key',
  API_URL: 'https://api.test',
  SESSION_SECRET: 'secret',
});

describe('ApiClient', () => {
  it('gives up on an API that does not answer', async () => {
    const silent = ((_url: URL, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
      )) as unknown as typeof fetch;
    const api = new ApiClient(env, silent, 30);
    await expect(api.request(null, '/status', { auth: false })).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      message: expect.stringMatching(/did not answer/),
    });
  });
});
