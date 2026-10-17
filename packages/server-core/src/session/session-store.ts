import { randomUUID } from 'node:crypto';
import { userInfo } from 'node:os';

import { Emitter, type Event } from '@nanoforge-dev/editor-kernel';
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
  /** Projects this session's user opened (ONLINE access control): cleared when the user changes. */
  readonly projects: Set<string>;
  lastSeen: number;
  /** Open WebSockets of this session: its projects stay open while there is one. */
  sockets: number;
}

export interface SessionResolution {
  readonly session: Session;
  /** `Set-Cookie` headers to send back (new session, refreshed tokens…). */
  readonly setCookies: string[];
}

export interface SessionStoreOptions {
  /**
   * Who an access token belongs to, asked to the API (`ApiClient.currentUser`). It may refresh
   * the session's tokens; null when the tokens are not valid.
   */
  readonly verify: (session: Session) => Promise<User | null>;
  /** Sessions kept at most; the least recently seen ones go first. */
  readonly maxSessions?: number;
}

const IDLE_TTL_MS = 7 * 24 * 3600 * 1000;
const MAX_SESSIONS = 10_000;

/** What the store remembers of the tokens it checked, per session. */
interface Verification {
  /** The access token the user was verified with (after a refresh, the new one). */
  token: string;
  /** The token a refresh replaced: requests sent before the new cookie arrived still carry it. */
  replaced?: string;
  pending?: Promise<void>;
}

/**
 * In-memory sessions identified by a signed cookie. OFFLINE sessions belong to the local OS user;
 * ONLINE sessions carry the API tokens found in the website cookies, and their user is the one
 * the API answers for them (a token is never trusted on its own).
 */
export class SessionStore {
  private readonly _sessions = new Map<string, Session>();
  private readonly _verifications = new Map<string, Verification>();
  private readonly _onDidDrop = new Emitter<Session>();

  /** A session was pruned or evicted: what it held can be released. */
  readonly onDidDrop: Event<Session> = this._onDidDrop.event;

  constructor(
    private readonly _env: EditorEnv,
    private readonly _options: SessionStoreOptions,
  ) {}

  /**
   * The session of a request. Without `create`, a request with no known session gets a
   * throwaway one that is neither stored nor sent back (static files, plugin files…).
   */
  async resolve(
    cookieHeader: string | null | undefined,
    options: { create?: boolean } = {},
  ): Promise<SessionResolution> {
    const cookies = parseCookies(cookieHeader);
    const setCookies: string[] = [];
    const id = cookies[SESSION_COOKIE] && unsign(cookies[SESSION_COOKIE], this._env.sessionSecret);
    let session = id ? this._sessions.get(id) : undefined;
    if (!session) {
      session = this._new();
      if (options.create === false) return { session, setCookies };
      this._store(session);
      setCookies.push(
        serializeCookie(SESSION_COOKIE, sign(session.id, this._env.sessionSecret), {
          secure: this._env.production && this._env.mode === 'ONLINE',
        }),
      );
    } else {
      this._sessions.delete(session.id);
      this._sessions.set(session.id, session);
    }
    session.lastSeen = Date.now();
    if (session.mode === 'ONLINE') await this._authenticate(session, cookies);
    return { session, setCookies };
  }

  /** Drops sessions idle for more than a week. */
  prune(now = Date.now()): void {
    for (const session of [...this._sessions.values()]) {
      if (now - session.lastSeen > IDLE_TTL_MS && !session.sockets) this._drop(session);
    }
  }

  /** Sessions that opened a project. */
  holders(projectId: string): Session[] {
    return [...this._sessions.values()].filter((session) => session.projects.has(projectId));
  }

  dispose(): void {
    this._onDidDrop.dispose();
  }

  private async _authenticate(session: Session, cookies: Record<string, string>): Promise<void> {
    const accessToken = cookies[ACCESS_TOKEN_COOKIE];
    const refreshToken = cookies[REFRESH_TOKEN_COOKIE];
    if (!accessToken && !refreshToken) {
      session.tokens = null;
      this._setUser(session, null);
      this._verifications.delete(session.id);
      return;
    }
    const known = this._verifications.get(session.id);
    if (known?.pending) return known.pending;
    if (known && (accessToken === known.token || (accessToken && accessToken === known.replaced)))
      return;
    session.tokens = { accessToken: accessToken ?? '', refreshToken: refreshToken ?? '' };
    const verification: Verification = { token: accessToken ?? '' };
    verification.pending = this._options
      .verify(session)
      .catch(() => null)
      .then((user) => {
        this._setUser(session, user);
        delete verification.pending;
        if (!user || !session.tokens) {
          this._verifications.delete(session.id);
          return;
        }
        verification.token = session.tokens.accessToken;
        if (accessToken && accessToken !== verification.token) verification.replaced = accessToken;
      });
    this._verifications.set(session.id, verification);
    return verification.pending;
  }

  /**
   * Who a session belongs to now. The projects it opened belong to its user: another user (or
   * none, after a sign-out) gets none of them, even on the same browser.
   */
  private _setUser(session: Session, user: User | null): void {
    if (user?.id !== session.user?.id) session.projects.clear();
    session.user = user;
  }

  private _new(): Session {
    const offline = this._env.mode === 'OFFLINE';
    return {
      id: randomUUID(),
      mode: this._env.mode,
      user: offline ? { id: 'local', name: localUserName() } : null,
      tokens: null,
      projects: new Set(),
      lastSeen: Date.now(),
      sockets: 0,
    };
  }

  private _store(session: Session): void {
    this._sessions.set(session.id, session);
    const max = this._options.maxSessions ?? MAX_SESSIONS;
    for (const oldest of this._sessions.values()) {
      if (this._sessions.size <= max) break;
      if (oldest !== session && !oldest.sockets) this._drop(oldest);
    }
  }

  private _drop(session: Session): void {
    this._sessions.delete(session.id);
    this._verifications.delete(session.id);
    this._onDidDrop.fire(session);
  }
}

const localUserName = () => {
  try {
    return userInfo().username;
  } catch {
    return 'local';
  }
};
