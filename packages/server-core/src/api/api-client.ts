import { z } from 'zod';

import type { User } from '@nanoforge-dev/editor-protocol';
import { RpcError, type RpcErrorCode } from '@nanoforge-dev/editor-rpc';

import type { EditorEnv } from '../env/editor-env.type';
import type { AuthTokens, Session } from '../session/session-store';

const API_STATUS_CODES: Record<number, RpcErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  412: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
};

export interface ApiRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Send the session tokens (default true). */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface TokenResponse extends AuthTokens {
  tokenExpiresAt: string;
}

/** A project of the API, as `/projects` and `/editor/projects/:id` answer it. */
export const GatewayProjectSchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  name: z.string(),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
  gatewayProjectRegistryUrl: z
    .string()
    .url()
    .refine((url) => /^https?:$/.test(new URL(url).protocol), 'must be an http(s) URL'),
  gatewayProjectRegistryMetadata: z
    .object({
      dir: z
        .string()
        .nullish()
        .transform((value) => value ?? null),
    })
    .nullish()
    .transform((value) => value ?? { dir: null }),
  token: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
});
export type GatewayProject = z.output<typeof GatewayProjectSchema>;

/** An entry of `/projects`: only what the project list shows. */
export const GatewayProjectSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
});
export type GatewayProjectSummary = z.output<typeof GatewayProjectSummarySchema>;

const ApiUserSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  username: z.string().nullish(),
  email: z.string().nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
});

const parseResponse = <T>(schema: z.ZodType<T>, value: unknown, what: string): T => {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new RpcError('UNAVAILABLE', `The NanoForge API sent an unexpected ${what}`, {
      detail: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    });
  return result.data;
};

/**
 * Client of api.nanoforge.eu. Authenticated calls refresh the access token once on 401 and
 * update the session tokens (the caller forwards them as cookies).
 */
export class ApiClient {
  /** One refresh at a time per session: with rotation, a second one would use a spent token. */
  private readonly _refreshing = new WeakMap<Session, Promise<AuthTokens>>();

  constructor(
    private readonly _env: EditorEnv,
    private readonly _fetch: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async request<T>(session: Session | null, path: string, request: ApiRequest = {}): Promise<T> {
    const auth = request.auth ?? true;
    if (auth && !session?.tokens) throw new RpcError('UNAUTHORIZED', 'Not signed in');
    const sent = auth ? session!.tokens!.accessToken : null;
    let response = await this._send(path, request, sent);
    if (auth && response.status === 401) {
      if (session!.tokens?.accessToken === sent) await this.refresh(session!);
      else await this._refreshing.get(session!);
      if (!session!.tokens) throw new RpcError('UNAUTHORIZED', 'Session expired, sign in again');
      response = await this._send(path, request, session!.tokens.accessToken);
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new RpcError(
        API_STATUS_CODES[response.status] ??
          (response.status >= 500 ? 'UNAVAILABLE' : 'BAD_REQUEST'),
        `NanoForge API ${request.method ?? 'GET'} ${path} failed (${response.status})`,
        detail ? { detail: detail.slice(0, 500) } : undefined,
      );
    }
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }

  refresh(session: Session): Promise<AuthTokens> {
    let refreshing = this._refreshing.get(session);
    if (!refreshing) {
      refreshing = this._refresh(session).finally(() => this._refreshing.delete(session));
      this._refreshing.set(session, refreshing);
    }
    return refreshing;
  }

  /** The user the session's tokens belong to (refreshing them if needed); null when invalid. */
  async currentUser(session: Session): Promise<User | null> {
    if (!session.tokens) return null;
    try {
      const user = parseResponse(ApiUserSchema, await this.request(session, '/users/me'), 'user');
      const name = user.username || [user.firstName, user.lastName].filter(Boolean).join(' ');
      return {
        id: user.id,
        name: name || user.email || 'NanoForge user',
        ...(user.email && { email: user.email }),
      };
    } catch (error) {
      if (error instanceof RpcError && error.code === 'UNAUTHORIZED') return null;
      throw error;
    }
  }

  async gatewayProjects(session: Session): Promise<GatewayProjectSummary[]> {
    const projects = await this.request(session, '/projects');
    return parseResponse(z.array(GatewayProjectSummarySchema), projects, 'project list');
  }

  async gatewayProject(session: Session, id: string): Promise<GatewayProject> {
    const project = await this.request(session, `/editor/projects/${encodeURIComponent(id)}`);
    return parseResponse(GatewayProjectSchema, project, 'project');
  }

  private async _refresh(session: Session): Promise<AuthTokens> {
    const refreshToken = session.tokens?.refreshToken;
    if (!refreshToken) throw new RpcError('UNAUTHORIZED', 'Session expired, sign in again');
    const response = await this._send(
      '/auth/refresh-token',
      {
        method: 'POST',
        body: { refreshToken },
      },
      null,
    );
    if (!response.ok) {
      session.tokens = null;
      session.user = null;
      throw new RpcError('UNAUTHORIZED', 'Session expired, sign in again');
    }
    const tokens = (await response.json()) as TokenResponse;
    session.tokens = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    return session.tokens;
  }

  private _send(path: string, request: ApiRequest, accessToken: string | null): Promise<Response> {
    const url = new URL(path, this._env.apiUrl);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return this._fetch(url, {
      method: request.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...(this._env.apiKey && { 'api-key': this._env.apiKey }),
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      },
      ...(request.body !== undefined && { body: JSON.stringify(request.body) }),
      ...(request.signal && { signal: request.signal }),
    });
  }
}
