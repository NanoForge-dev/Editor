import { describe, expect, it } from 'vitest';

/**
 * What the editor needs from the NanoForge API (docs/api/README.md), as scenarios that only
 * speak HTTP. They run against the in-memory mock in the editor's own tests, and against a real
 * API when `CONTRACT_API_URL` is set (see `api.contract.test.ts`).
 *
 * On a real API they use one test account and leave it as they found it: the settings document
 * is put back at the end.
 */
export interface ApiTarget {
  readonly baseUrl: string;
  readonly fetch: typeof fetch;
  readonly apiKey: string;
  /** A valid access token of the test account. */
  readonly accessToken: string;
  /** Tests token refresh when given. A real API rotates it: the old value stops working. */
  readonly refreshToken?: string | undefined;
  /** A project of the test account, to test the project endpoints. */
  readonly projectId?: string | undefined;
  /** Which features the API has (`API_FEATURES` of the editor): their scenarios run. */
  readonly features: readonly string[];
}

interface Answer {
  status: number;
  body: unknown;
}

export const apiContract = (target: () => ApiTarget): void => {
  const call = async (
    method: string,
    path: string,
    options: { body?: unknown; token?: string | null; apiKey?: string | null } = {},
  ): Promise<Answer> => {
    const { baseUrl, fetch, apiKey, accessToken } = target();
    const token = options.token === undefined ? accessToken : options.token;
    const key = options.apiKey === undefined ? apiKey : options.apiKey;
    const response = await fetch(new URL(path, baseUrl), {
      method,
      headers: {
        'content-type': 'application/json',
        ...(key && { 'api-key': key }),
        ...(token && { authorization: `Bearer ${token}` }),
      },
      ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    return { status: response.status, body };
  };
  const has = (feature: string) => target().features.includes(feature);

  describe('authentication', () => {
    it('refuses a bad access token with 401', async () => {
      const answer = await call('GET', '/projects', { token: 'not-a-token' });
      expect(answer.status).toBe(401);
    });

    it('refreshes a token pair, and refuses a bad refresh token with 401', async (context) => {
      const { refreshToken } = target();
      if (!refreshToken) return context.skip();
      const bad = await call('POST', '/auth/refresh-token', {
        token: null,
        body: { refreshToken: 'not-a-token' },
      });
      expect(bad.status).toBe(401);
      const answer = await call('POST', '/auth/refresh-token', {
        token: null,
        body: { refreshToken },
      });
      expect(answer.status).toBeLessThan(300);
      expect(answer.body).toMatchObject({
        accessToken: expect.any(String) as string,
        refreshToken: expect.any(String) as string,
        tokenExpiresAt: expect.any(String) as string,
      });
    });
  });

  describe('projects', () => {
    const PROJECT = {
      id: expect.any(String) as string,
      code: expect.any(String) as string,
      name: expect.any(String) as string,
      gatewayProjectRegistryUrl: expect.any(String) as string,
      gatewayProjectRegistryMetadata: expect.any(Object) as object,
    };

    it('lists the projects of the user', async () => {
      const answer = await call('GET', '/projects');
      expect(answer.status).toBe(200);
      expect(Array.isArray(answer.body)).toBe(true);
      for (const project of answer.body as unknown[]) expect(project).toMatchObject(PROJECT);
    });

    it('gives the editor a project with a token to clone it', async (context) => {
      const { projectId } = target();
      if (!projectId) return context.skip();
      const answer = await call('GET', `/editor/projects/${encodeURIComponent(projectId)}`);
      expect(answer.status).toBe(200);
      expect(answer.body).toMatchObject({ ...PROJECT, id: projectId, token: expect.any(String) });
      const unknown = await call('GET', '/editor/projects/00000000-0000-4000-8000-000000000000');
      expect([403, 404]).toContain(unknown.status);
    });
  });

  describe('settings sync', () => {
    const PATH = '/users/me/editor-settings';
    interface Document {
      revision: string | null;
      values: Record<string, unknown>;
    }
    /** The document, or the empty one a 404 stands for. */
    const read = async (): Promise<Document> => {
      const answer = await call('GET', PATH);
      expect([200, 404]).toContain(answer.status);
      if (answer.status === 404) return { revision: null, values: {} };
      expect(answer.body).toMatchObject({
        revision: expect.any(String) as string,
        values: expect.any(Object) as object,
      });
      return answer.body as Document;
    };

    it('needs a signed-in user', async (context) => {
      if (!has('settings')) return context.skip();
      expect((await call('GET', PATH, { token: 'not-a-token' })).status).toBe(401);
      expect(
        (await call('PUT', PATH, { token: null, body: { baseRevision: null, values: {} } })).status,
      ).toBe(401);
    });

    it('saves on the right revision, refuses a stale one with the current document', async (context) => {
      if (!has('settings')) return context.skip();
      const original = await read();
      const values = { ...original.values, 'contract.test': Date.now() };
      try {
        const saved = await call('PUT', PATH, {
          body: { baseRevision: original.revision, values },
        });
        expect(saved.status).toBe(200);
        const { revision } = saved.body as { revision: string };
        expect(typeof revision).toBe('string');
        expect(revision).not.toBe(original.revision);
        expect(await read()).toEqual({ revision, values });

        const stale = await call('PUT', PATH, {
          body: { baseRevision: original.revision, values: { 'contract.test': 'stale' } },
        });
        expect(stale.status).toBe(409);
        expect(stale.body).toEqual({ revision, values });
        expect(await read()).toEqual({ revision, values });
      } finally {
        const current = await read();
        await call('PUT', PATH, {
          body: { baseRevision: current.revision, values: original.values },
        });
      }
    });

    it('refuses a malformed body with 400 and an oversized one with 413', async (context) => {
      if (!has('settings')) return context.skip();
      const before = await read();
      const malformed = await call('PUT', PATH, {
        body: { baseRevision: before.revision, values: 'not an object' },
      });
      expect(malformed.status).toBe(400);
      const tooMany = Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`k${i}`, i]));
      const large = await call('PUT', PATH, {
        body: { baseRevision: before.revision, values: tooMany },
      });
      expect(large.status).toBe(413);
      expect(await read()).toEqual(before);
    });
  });
};
