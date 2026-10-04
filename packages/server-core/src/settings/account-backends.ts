import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { Emitter, type Event } from '@nanoforge-dev/editor-kernel';
import { type AccountSettingsDocument, SETTINGS_LIMITS } from '@nanoforge-dev/editor-protocol';
import { RpcError } from '@nanoforge-dev/editor-rpc';

import type { ApiClient } from '../api/api-client';
import type { EditorEnv } from '../env/editor-env.type';
import type { Session } from '../session/session-store';
import { shortHash } from '../util/hash';
import { KeyedMutex } from '../util/keyed-mutex';

type Values = AccountSettingsDocument['values'];

/** Where account settings live: the NanoForge API (online) or the data dir (offline). */
export interface AccountSettingsBackend {
  /** Fires with the user id when a document was saved through this server. */
  readonly onDidChange: Event<{ userId: string; revision: string }>;
  get(session: Session): Promise<AccountSettingsDocument>;
  put(session: Session, baseRevision: string | null, values: Values): Promise<{ revision: string }>;
}

const userOf = (session: Session) => {
  if (!session.user) throw new RpcError('UNAUTHORIZED', 'Not signed in');
  return session.user;
};

export const checkLimits = (values: Values): void => {
  const keys = Object.keys(values).length;
  const bytes = new TextEncoder().encode(JSON.stringify(values)).length;
  if (keys > SETTINGS_LIMITS.maxKeys || bytes > SETTINGS_LIMITS.maxBytes) {
    throw new RpcError('PAYLOAD_TOO_LARGE', `Settings too large (${keys} keys, ${bytes} bytes)`);
  }
};

const conflict = (current: AccountSettingsDocument) =>
  new RpcError('CONFLICT', 'Settings changed on another device', current);

/** Offline editors: one revisioned JSON document per local user in the data dir. */
export class FileAccountBackend implements AccountSettingsBackend {
  private readonly _mutex = new KeyedMutex();
  private readonly _onDidChange = new Emitter<{ userId: string; revision: string }>();

  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly _env: EditorEnv) {}

  get(session: Session): Promise<AccountSettingsDocument> {
    return this._read(this._file(userOf(session).id));
  }

  async put(
    session: Session,
    baseRevision: string | null,
    values: Values,
  ): Promise<{ revision: string }> {
    const user = userOf(session);
    checkLimits(values);
    const file = this._file(user.id);
    return this._mutex.run(file, async () => {
      const current = await this._read(file);
      if (current.revision !== baseRevision) throw conflict(current);
      const revision = String(Number(current.revision ?? '0') + 1);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, `${JSON.stringify({ revision, values }, null, 2)}\n`);
      this._onDidChange.fire({ userId: user.id, revision });
      return { revision };
    });
  }

  private _file(userId: string): string {
    return join(this._env.dataDir, 'settings', 'accounts', `${shortHash(userId)}.json`);
  }

  private async _read(file: string): Promise<AccountSettingsDocument> {
    try {
      const document = JSON.parse(await readFile(file, 'utf8')) as AccountSettingsDocument;
      return { revision: document.revision ?? null, values: document.values ?? {} };
    } catch {
      return { revision: null, values: {} };
    }
  }
}

/**
 * Online editors: `GET/PUT /users/me/editor-settings` of the NanoForge API
 * (contract: docs/api/settings-sync.md).
 */
export class ApiAccountBackend implements AccountSettingsBackend {
  private readonly _onDidChange = new Emitter<{ userId: string; revision: string }>();

  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly _api: ApiClient) {}

  async get(session: Session): Promise<AccountSettingsDocument> {
    try {
      return await this._api.request<AccountSettingsDocument>(session, '/users/me/editor-settings');
    } catch (error) {
      if (RpcError.is(error, 'NOT_FOUND')) return { revision: null, values: {} };
      throw error;
    }
  }

  async put(
    session: Session,
    baseRevision: string | null,
    values: Values,
  ): Promise<{ revision: string }> {
    const user = userOf(session);
    checkLimits(values);
    try {
      const result = await this._api.request<{ revision: string }>(
        session,
        '/users/me/editor-settings',
        {
          method: 'PUT',
          body: { baseRevision, values },
        },
      );
      this._onDidChange.fire({ userId: user.id, revision: result.revision });
      return result;
    } catch (error) {
      if (RpcError.is(error, 'CONFLICT')) throw conflict(await this.get(session));
      throw error;
    }
  }
}

/** Hosted editors: per user and project settings, outside the shared project checkout. */
export class ProjectLocalSettingsStore {
  private readonly _mutex = new KeyedMutex();

  constructor(private readonly _env: EditorEnv) {}

  async get(session: Session, projectId: string): Promise<Values> {
    try {
      return JSON.parse(await readFile(this._file(session, projectId), 'utf8')) as Values;
    } catch {
      return {};
    }
  }

  async put(session: Session, projectId: string, values: Values): Promise<void> {
    checkLimits(values);
    const file = this._file(session, projectId);
    return this._mutex.run(file, async () => {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, `${JSON.stringify(values, null, 2)}\n`);
    });
  }

  private _file(session: Session, projectId: string): string {
    const user = shortHash(userOf(session).id);
    return join(this._env.dataDir, 'settings', 'project-local', user, `${projectId}.json`);
  }
}
