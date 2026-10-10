import { describe, expect, it } from 'vitest';

import { ApiClient } from '../../src/api/api-client';
import { loadEnv } from '../../src/env/load-env';
import { serializeCookie, sign } from '../../src/session/cookies';
import { SESSION_COOKIE, type Session, SessionStore } from '../../src/session/session-store';
import { createMockApi } from '../mocks/nanoforge-api';

const env = loadEnv({
  NODE_ENV: 'test',
  PUBLIC_MODE: 'ONLINE',
  API_KEY: 'test-key',
  API_URL: 'https://api.test',
  SESSION_SECRET: 'secret',
});

const setup = (maxSessions?: number) => {
  const mock = createMockApi();
  const api = new ApiClient(env, mock.fetch);
  const store = new SessionStore(env, {
    verify: (session) => api.currentUser(session),
    ...(maxSessions && { maxSessions }),
  });
  return { mock, api, store };
};

const cookieOf = (setCookies: string[]) => setCookies[0]!.split(';')[0]!;
const forgedJwt = `x.${Buffer.from(JSON.stringify({ sub: 'user-1', name: 'Ada' })).toString('base64url')}.x`;

describe('SessionStore', () => {
  it('signs in only with a token the API accepts', async () => {
    const { store, mock } = setup();
    const forged = await store.resolve(`accessToken=${forgedJwt}`);
    expect(forged.session.user).toBeNull();

    const { session, setCookies } = await store.resolve(
      'accessToken=access-1; refreshToken=refresh-1',
    );
    expect(session.user).toEqual({ id: 'user-1', name: 'ada', email: 'ada@nanoforge.test' });
    const calls = mock.calls.length;
    await store.resolve(`${cookieOf(setCookies)}; accessToken=access-1; refreshToken=refresh-1`);
    expect(mock.calls.length).toBe(calls);
  });

  it('refreshes once for parallel expired requests', async () => {
    const { store, api, mock } = setup();
    const { session } = await store.resolve('accessToken=access-1; refreshToken=refresh-1');
    mock.expireAccessToken();
    await Promise.all([api.gatewayProjects(session), api.gatewayProjects(session)]);
    expect(mock.calls.filter((call) => call === 'POST /auth/refresh-token')).toHaveLength(1);
    expect(session.user?.id).toBe('user-1');
  });

  it('keeps no session for requests that do not need one, and caps the others', async () => {
    const { store } = setup(2);
    const dropped: Session[] = [];
    store.onDidDrop((session) => dropped.push(session));
    const throwaway = await store.resolve(null, { create: false });
    expect(throwaway.setCookies).toEqual([]);
    const first = await store.resolve(null);
    await store.resolve(null);
    await store.resolve(null);
    expect(dropped).toEqual([first.session]);
    const again = await store.resolve(
      serializeCookie(SESSION_COOKIE, sign(first.session.id, env.sessionSecret)),
    );
    expect(again.session.id).not.toBe(first.session.id);
  });
});
