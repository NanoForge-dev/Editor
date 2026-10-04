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

export interface GatewayProject {
  id: string;
  code: string;
  name: string;
  description: string;
  gatewayProjectRegistryUrl: string;
  gatewayProjectRegistryMetadata: { dir: string | null };
  token: string;
}

/**
 * Client of api.nanoforge.eu. Authenticated calls refresh the access token once on 401 and
 * update the session tokens (the caller forwards them as cookies).
 */
export class ApiClient {
  constructor(
    private readonly _env: EditorEnv,
    private readonly _fetch: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async request<T>(session: Session | null, path: string, request: ApiRequest = {}): Promise<T> {
    const auth = request.auth ?? true;
    if (auth && !session?.tokens) throw new RpcError('UNAUTHORIZED', 'Not signed in');
    let response = await this._send(path, request, auth ? session!.tokens!.accessToken : null);
    if (auth && response.status === 401) {
      await this.refresh(session!);
      response = await this._send(path, request, session!.tokens!.accessToken);
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

  async refresh(session: Session): Promise<AuthTokens> {
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

  gatewayProjects(session: Session): Promise<GatewayProject[]> {
    return this.request(session, '/projects');
  }

  gatewayProject(session: Session, id: string): Promise<GatewayProject> {
    return this.request(session, `/editor/projects/${encodeURIComponent(id)}`);
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
