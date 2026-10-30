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
  it("gives a new user none of the previous user's projects", async () => {
    const store = new SessionStore(env, {
      verify: async (session) => {
        const id = session.tokens?.accessToken.replace('access-', '');
        return id ? { id, name: id, email: `${id}@nanoforge.test` } : null;
      },
    });
    const first = await store.resolve('accessToken=access-ada; refreshToken=r');
    const cookie = cookieOf(first.setCookies);
    first.session.projects.add('project-1');

    await store.resolve(`${cookie}; accessToken=access-ada2; refreshToken=r`);
    expect(first.session.user?.id).toBe('ada2');
    expect([...first.session.projects]).toEqual([]);

    first.session.projects.add('project-2');
    await store.resolve(`${cookie}; accessToken=access-ada2; refreshToken=r`);
    expect([...first.session.projects]).toEqual(['project-2']);
    await store.resolve(cookie);
    expect(first.session.user).toBeNull();
    expect([...first.session.projects]).toEqual([]);
  });

  it('takes the projects of a session away when its user changes or signs out', async () => {
    const users: Record<string, { id: string; name: string }> = {
      'access-ada': { id: 'ada', name: 'Ada' },
      'access-bob': { id: 'bob', name: 'Bob' },
    };
    const store = new SessionStore(env, {
      verify: async (session) => users[session.tokens?.accessToken ?? ''] ?? null,
    });
    const first = await store.resolve('accessToken=access-ada; refreshToken=r');
    const cookie = cookieOf(first.setCookies);
    first.session.projects.add('ada-project');

    const same = await store.resolve(`${cookie}; accessToken=access-ada; refreshToken=r`);
    expect(same.session.projects.has('ada-project')).toBe(true);

    const bob = await store.resolve(`${cookie}; accessToken=access-bob; refreshToken=r`);
    expect(bob.session).toBe(first.session);
    expect(bob.session.user?.id).toBe('bob');
    expect(bob.session.projects.size).toBe(0);

    bob.session.projects.add('bob-project');
    const out = await store.resolve(cookie);
    expect(out.session.user).toBeNull();
    expect(out.session.projects.size).toBe(0);
  });

  it('asks the API once about tokens it refused, and keeps signed-in users over anonymous ones', async () => {
    let asked = 0;
    const store = new SessionStore(env, {
      verify: async (session) => {
        asked++;
        return session.tokens?.accessToken === 'good' ? { id: 'ada', name: 'Ada' } : null;
      },
      maxSessions: 2,
    });
    const bad = await store.resolve('accessToken=bad; refreshToken=r');
    const cookie = cookieOf(bad.setCookies);
    await store.resolve(`${cookie}; accessToken=bad; refreshToken=r`);
    await store.resolve(`${cookie}; accessToken=bad; refreshToken=r`);
    expect(asked).toBe(1);
    const good = await store.resolve(`${cookie}; accessToken=good; refreshToken=r`);
    expect(good.session.user?.id).toBe('ada');
    expect(asked).toBe(2);

    for (let index = 0; index < 5; index++) await store.resolve(null);
    const again = await store.resolve(`${cookie}; accessToken=good; refreshToken=r`);
    expect(again.session).toBe(good.session);
  });
});
