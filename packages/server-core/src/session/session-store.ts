import { randomUUID } from 'node:crypto';
import { userInfo } from 'node:os';

import type { User } from '@nanoforge-dev/editor-protocol';

import type { EditorEnv } from '../env/editor-env.type';
import { parseCookies, serializeCookie, sign, unsign } from './cookies';

export const SESSION_COOKIE = 'nf_editor_session';
/** Set by the NanoForge projects website (shared parent domain) in ONLINE mode. */
export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Session {
  readonly id: string;
  readonly mode: 'OFFLINE' | 'ONLINE';
  user: User | null;
  tokens: AuthTokens | null;
  /** Projects this session opened (ONLINE access control). */
  readonly projects: Set<string>;
  lastSeen: number;
}

export interface SessionResolution {
  readonly session: Session;
  /** `Set-Cookie` headers to send back (new session, refreshed tokens…). */
  readonly setCookies: string[];
}

const IDLE_TTL_MS = 7 * 24 * 3600 * 1000;

/** Best-effort, unverified read of a JWT payload (display only; the API verifies tokens). */
const decodeJwtUser = (token: string): User | null => {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as {
      sub?: string;
      id?: string;
      email?: string;
      name?: string;
      username?: string;
    };
    const id = payload.sub ?? payload.id;
    if (!id) return null;
    return {
      id: String(id),
      name: payload.name ?? payload.username ?? payload.email ?? 'NanoForge user',
      ...(payload.email && { email: payload.email }),
    };
  } catch {
    return null;
  }
};

/**
 * In-memory sessions identified by a signed cookie. OFFLINE sessions belong to the local OS user;
 * ONLINE sessions carry the API tokens found in the website cookies.
 */
export class SessionStore {
  private readonly _sessions = new Map<string, Session>();

  constructor(private readonly _env: EditorEnv) {}

  resolve(cookieHeader: string | null | undefined): SessionResolution {
    const cookies = parseCookies(cookieHeader);
    const setCookies: string[] = [];
    const id = cookies[SESSION_COOKIE] && unsign(cookies[SESSION_COOKIE], this._env.sessionSecret);
    let session = id ? this._sessions.get(id) : undefined;
    if (!session) {
      session = this._create();
      setCookies.push(
        serializeCookie(SESSION_COOKIE, sign(session.id, this._env.sessionSecret), {
          secure: this._env.production && this._env.mode === 'ONLINE',
        }),
      );
    }
    session.lastSeen = Date.now();

    if (session.mode === 'ONLINE') {
      const accessToken = cookies[ACCESS_TOKEN_COOKIE];
      const refreshToken = cookies[REFRESH_TOKEN_COOKIE];
      if (accessToken || refreshToken) {
        session.tokens = { accessToken: accessToken ?? '', refreshToken: refreshToken ?? '' };
        session.user = (accessToken && decodeJwtUser(accessToken)) || session.user;
      } else {
        session.tokens = null;
        session.user = null;
      }
    }
    return { session, setCookies };
  }

  logout(session: Session): string[] {
    this._sessions.delete(session.id);
    return [serializeCookie(SESSION_COOKIE, '', { maxAge: 0 })];
  }

  /** Drops sessions idle for more than a week. */
  prune(now = Date.now()): void {
    for (const [id, session] of this._sessions) {
      if (now - session.lastSeen > IDLE_TTL_MS) this._sessions.delete(id);
    }
  }

  private _create(): Session {
    const offline = this._env.mode === 'OFFLINE';
    const session: Session = {
      id: randomUUID(),
      mode: this._env.mode,
      user: offline ? { id: 'local', name: localUserName() } : null,
      tokens: null,
      projects: new Set(),
      lastSeen: Date.now(),
    };
    this._sessions.set(session.id, session);
    return session;
  }
}

const localUserName = () => {
  try {
    return userInfo().username;
  } catch {
    return 'local';
  }
};
