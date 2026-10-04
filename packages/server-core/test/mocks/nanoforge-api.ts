/**
 * In-memory NanoForge API implementing what the editor calls (docs/api/README.md): the settings
 * sync contract, token refresh and the project endpoints. Used as `fetch` by the ApiClient in
 * tests, and as the default target of the contract tests (`test/contract`), which can run
 * against a staging API instead.
 */
export interface MockApiOptions {
  apiKey?: string;
  /** Access token considered valid; others get 401. */
  validAccessToken?: string;
  refreshToken?: string;
}

/** The project of the mock's user. */
export const PROJECT = {
  id: 'project-1',
  code: 'pong',
  name: 'Pong',
  description: 'A game',
  gatewayProjectRegistryUrl: 'https://git.test/ada/pong.git',
  gatewayProjectRegistryMetadata: { dir: null },
  token: 'git-token',
};

export const createMockApi = (options: MockApiOptions = {}) => {
  const apiKey = options.apiKey ?? 'test-key';
  const validAccess = new Set([options.validAccessToken ?? 'access-1']);
  const refresh = options.refreshToken ?? 'refresh-1';
  const documents = new Map<string, { revision: string; values: Record<string, unknown> }>();
  const calls: string[] = [];

  const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    calls.push(`${method} ${url.pathname}`);
    if (headers.get('api-key') !== apiKey) return json(403, { message: 'bad api key' });

    if (url.pathname === '/auth/refresh-token' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { refreshToken: string };
      if (body.refreshToken !== refresh) return json(401, { message: 'bad refresh token' });
      const accessToken = `access-${calls.length}`;
      validAccess.add(accessToken);
      return json(200, {
        accessToken,
        refreshToken: refresh,
        tokenExpiresAt: new Date().toISOString(),
      });
    }
    if (!validAccess.has((headers.get('authorization') ?? '').replace(/^Bearer /, '')))
      return json(401, { message: 'expired' });

    if (url.pathname === '/users/me/editor-settings') {
      const user = 'user-1';
      const current = documents.get(user);
      if (method === 'GET') return current ? json(200, current) : json(404, { message: 'none' });
      if (method === 'PUT') {
        let body: { baseRevision: string | null; values: Record<string, unknown> };
        try {
          body = JSON.parse(String(init?.body)) as typeof body;
        } catch {
          return json(400, { message: 'malformed body' });
        }
        if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values))
          return json(400, { message: 'values must be an object' });
        if (
          Object.keys(body.values).length > 2000 ||
          JSON.stringify(body.values).length > 256 * 1024
        )
          return json(413, { message: 'too large' });
        if ((current?.revision ?? null) !== body.baseRevision) {
          return json(409, current ?? { revision: null, values: {} });
        }
        const next = { revision: String(Number(current?.revision ?? 0) + 1), values: body.values };
        documents.set(user, next);
        return json(200, { revision: next.revision });
      }
    }
    if (url.pathname === '/projects' && method === 'GET') return json(200, [PROJECT]);
    if (url.pathname === `/editor/projects/${PROJECT.id}` && method === 'GET')
      return json(200, PROJECT);
    return json(404, { message: 'not found' });
  };

  return {
    fetch: fetch as typeof globalThis.fetch,
    documents,
    calls,
    expireAccessToken: () => {
      validAccess.clear();
    },
  };
};
