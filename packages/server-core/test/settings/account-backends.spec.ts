import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ApiClient } from '../../src/api/api-client';
import { loadEnv } from '../../src/env/load-env';
import type { Session } from '../../src/session/session-store';
import { ApiAccountBackend, FileAccountBackend } from '../../src/settings/account-backends';
import { createMockApi } from '../mocks/nanoforge-api';

const session = (tokens: Session['tokens'] = null): Session => ({
  id: 's',
  mode: tokens ? 'ONLINE' : 'OFFLINE',
  user: { id: 'user-1', name: 'Ada' },
  tokens,
  projects: new Set(),
  lastSeen: 0,
});

describe('FileAccountBackend', () => {
  const backend = () =>
    new FileAccountBackend(loadEnv({ DATA_DIR: mkdtempSync(join(tmpdir(), 'nf-settings-')) }));

  it('stores revisioned documents and rejects stale writes', async () => {
    const files = backend();
    const changes: string[] = [];
    files.onDidChange(({ revision }) => changes.push(revision));
    const user = session();
    expect(await files.get(user)).toEqual({ revision: null, values: {} });
    const { revision } = await files.put(user, null, { 'editor.fontSize': 14 });
    expect(await files.get(user)).toEqual({ revision, values: { 'editor.fontSize': 14 } });
    await expect(files.put(user, null, {})).rejects.toMatchObject({
      code: 'CONFLICT',
      data: { revision, values: { 'editor.fontSize': 14 } },
    });
    expect(changes).toEqual([revision]);
  });

  it('enforces size limits', async () => {
    const values = Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`k${i}`, i]));
    await expect(backend().put(session(), null, values)).rejects.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
    });
  });
});

describe('ApiAccountBackend (mock NanoForge API)', () => {
  const setup = () => {
    const api = createMockApi();
    const env = loadEnv({
      PUBLIC_MODE: 'ONLINE',
      API_KEY: 'test-key',
      API_URL: 'https://api.test',
    });
    return { api, backend: new ApiAccountBackend(new ApiClient(env, api.fetch)) };
  };

  it('reads, writes and maps conflicts with the current document', async () => {
    const { backend } = setup();
    const user = session({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    expect(await backend.get(user)).toEqual({ revision: null, values: {} });
    const first = await backend.put(user, null, { a: 1 });
    await expect(backend.put(user, null, { a: 2 })).rejects.toMatchObject({
      code: 'CONFLICT',
      data: { revision: first.revision, values: { a: 1 } },
    });
  });

  it('refreshes expired access tokens once', async () => {
    const { api, backend } = setup();
    const user = session({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    api.expireAccessToken();
    await backend.put(user, null, { a: 1 });
    expect(user.tokens!.accessToken).not.toBe('access-1');
    expect(api.calls).toEqual([
      'PUT /users/me/editor-settings',
      'POST /auth/refresh-token',
      'PUT /users/me/editor-settings',
    ]);
  });
});
