import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

import {
  type Disposable,
  DisposableStore,
  Emitter,
  type Event,
  type Logger,
  type Observable,
  ObservableValue,
} from '@nanoforge-dev/editor-kernel';
import type { ProjectModel, ProjectRef, RecentProject, User } from '@nanoforge-dev/editor-protocol';
import { RpcError } from '@nanoforge-dev/editor-rpc';

import type { ApiClient } from '../api/api-client';
import type { EditorEnv } from '../env/editor-env.type';
import { NFIGNORE_FILE, ProjectFileSystem } from '../fs/fs-service';
import { PathJail } from '../fs/path-jail';
import { ProjectWatcher } from '../fs/watcher';
import type { GitService } from '../git/git-service';
import type { Session } from '../session/session-store';
import { shortHash } from '../util/hash';
import { KeyedMutex } from '../util/keyed-mutex';
import { type ConfigLoader, executingConfigLoader, staticConfigLoader } from './config-loader';
import { discoverProject } from './discovery';

const MAX_RECENT = 20;
const GATEWAY_ID = /^[\w-]{1,60}$/;
const CONFIG_CHANGE = /(^|\/)(nanoforge\.config\.[mc]?[jt]s|package\.json)$/;

/** An opened project: its files, watcher and live model. */
export class OpenProject implements Disposable {
  readonly fs: ProjectFileSystem;
  readonly watcher: ProjectWatcher;
  private readonly _model: ObservableValue<ProjectModel>;
  private readonly _store = new DisposableStore();
  private _rediscovery: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly id: string,
    readonly root: string,
    readonly ref: ProjectRef,
    readonly location: string,
    initial: ProjectModel,
    private readonly _loader: ConfigLoader,
    private readonly _logger: Logger,
  ) {
    this.fs = new ProjectFileSystem(root);
    this._model = new ObservableValue(initial);
    this.watcher = new ProjectWatcher(this.fs.jail, {
      ignoredPaths: () => this._model.get().apps.flatMap((app) => (app.outDir ? [app.outDir] : [])),
      isIgnored: (path, directory) => this.fs.isIgnored(path, directory),
    });
    void this.fs.refreshIgnore();
    this._store.add(
      this.watcher.onDidChange((changes) => {
        if (changes.some((change) => CONFIG_CHANGE.test(change.path))) this._scheduleRediscovery();
        if (changes.some((change) => change.path === NFIGNORE_FILE)) void this.fs.refreshIgnore();
      }),
    );
  }

  get name(): string {
    return this._model.get().name;
  }

  get model(): Observable<ProjectModel> {
    return this._model.readonly();
  }

  async rediscover(): Promise<ProjectModel> {
    const model = await discoverProject({
      id: this.id,
      root: this.root,
      location: this.location,
      loader: this._loader,
    });
    this._model.set(model);
    return model;
  }

  dispose(): void {
    clearTimeout(this._rediscovery);
    this._store.dispose();
    this.watcher.dispose();
  }

  private _scheduleRediscovery(): void {
    clearTimeout(this._rediscovery);
    this._rediscovery = setTimeout(() => {
      this.rediscover().catch((error: unknown) =>
        this._logger.error(`Rediscovery of ${this.id} failed`, error),
      );
    }, 200);
  }
}

interface RecentStore {
  [userId: string]: (Omit<RecentProject, 'openedAt'> & { openedAt: string })[];
}

/**
 * Opens projects and keeps them alive. Project ids are stable: a hash of the real path
 * (offline) or the gateway id (online), independent from sessions.
 */
export class ProjectRegistry implements Disposable {
  private readonly _projects = new Map<string, OpenProject>();
  /** When each open project was last asked for. */
  private readonly _lastUsed = new Map<string, number>();
  private readonly _opening = new KeyedMutex();
  private readonly _recentLock = new KeyedMutex();
  private readonly _loader: ConfigLoader;
  private readonly _onDidClose = new Emitter<string>();

  /** A project was closed (nobody uses it anymore): its runtime can stop too. */
  readonly onDidClose: Event<string> = this._onDidClose.event;

  constructor(
    private readonly _env: EditorEnv,
    private readonly _git: GitService,
    private readonly _api: ApiClient,
    private readonly _logger: Logger,
  ) {
    this._loader = _env.mode === 'ONLINE' ? staticConfigLoader : executingConfigLoader;
  }

  async open(session: Session, ref: ProjectRef): Promise<OpenProject> {
    const project =
      'path' in ref
        ? await this._openLocal(ref.path)
        : await this._openGateway(session, ref.gatewayId);
    session.projects.add(project.id);
    this._lastUsed.set(project.id, Date.now());
    if (session.user) await this._remember(session.user, project);
    return project;
  }

  /** Returns an opened project the session may access, else throws NOT_FOUND. */
  get(session: Session, id: string): OpenProject {
    const project = this._projects.get(id);
    const allowed = session.mode === 'OFFLINE' || session.projects.has(id);
    if (!project || !allowed) throw new RpcError('NOT_FOUND', `Project ${id} is not open`);
    this._lastUsed.set(id, Date.now());
    return project;
  }

  /** Ids of the open projects. */
  get openIds(): string[] {
    return [...this._projects.keys()];
  }

  /**
   * Closes the projects nobody uses: no `inUse` (a connected editor holds it) and not asked for
   * during `idleMs`. Each one keeps a watcher, so a hosted server must not keep them all.
   */
  sweep(inUse: (id: string) => boolean, idleMs: number, now = Date.now()): void {
    for (const id of this.openIds) {
      if (!inUse(id) && now - (this._lastUsed.get(id) ?? 0) > idleMs) this.close(id);
    }
  }

  close(id: string): void {
    const project = this._projects.get(id);
    if (!project) return;
    this._projects.delete(id);
    this._lastUsed.delete(id);
    project.dispose();
    this._logger.info(`Closed project ${project.name} (${id})`);
    this._onDidClose.fire(id);
  }

  async recent(user: User): Promise<RecentProject[]> {
    const store = await this._readRecent();
    return (store[user.id] ?? []).map((entry) => ({
      ...entry,
      openedAt: new Date(entry.openedAt),
    }));
  }

  forget(user: User, id: string): Promise<void> {
    return this._updateRecent((store) => {
      store[user.id] = (store[user.id] ?? []).filter((entry) => entry.id !== id);
    });
  }

  dispose(): void {
    for (const project of this._projects.values()) project.dispose();
    this._projects.clear();
    this._onDidClose.dispose();
  }

  private async _openLocal(path: string): Promise<OpenProject> {
    if (this._env.mode === 'ONLINE') {
      throw new RpcError('FORBIDDEN', 'Local projects cannot be opened on a hosted editor');
    }
    const target = resolve(this._env.fsRoot, path);
    const rel = relative(this._env.fsRoot, target);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new RpcError('FORBIDDEN', `Projects must be inside ${this._env.fsRoot}`);
    }
    const info = await stat(target).catch(() => undefined);
    if (!info?.isDirectory()) throw new RpcError('NOT_FOUND', `No project directory at ${path}`);
    const real = await realpath(target);
    return this._getOrCreate(shortHash(real), real, { path: real }, real);
  }

  private async _openGateway(session: Session, gatewayId: string): Promise<OpenProject> {
    if (this._env.mode !== 'ONLINE') {
      throw new RpcError('FORBIDDEN', 'Gateway projects need an online editor');
    }
    if (!GATEWAY_ID.test(gatewayId)) {
      throw new RpcError('BAD_REQUEST', `Not a project id: ${gatewayId.slice(0, 80)}`);
    }
    const gateway = await this._api.gatewayProject(session, gatewayId);
    const id = `gw-${gatewayId}`;
    return this._opening.run(id, async () => {
      const root = join(this._env.fsRoot, id);
      const url = gateway.gatewayProjectRegistryUrl;
      if (!this._git.isRepository(root)) {
        await mkdir(dirname(root), { recursive: true });
        await this._git.clone(url, root, gateway.token);
      } else if (!this._projects.has(id)) {
        await this._git.pull(root, url, gateway.token);
      }
      const subdir = gateway.gatewayProjectRegistryMetadata.dir;
      const projectRoot = subdir ? await new PathJail(root).resolve(subdir) : root;
      return this._getOrCreate(id, projectRoot, { gatewayId }, gateway.name);
    });
  }

  private _getOrCreate(
    id: string,
    root: string,
    ref: ProjectRef,
    location: string,
  ): Promise<OpenProject> {
    return this._opening.run(`open:${id}`, async () => {
      const existing = this._projects.get(id);
      if (existing) return existing;
      const model = await discoverProject({ id, root, location, loader: this._loader });
      const project = new OpenProject(id, root, ref, location, model, this._loader, this._logger);
      this._projects.set(id, project);
      this._logger.info(`Opened project ${model.name} (${id}) at ${root}`);
      return project;
    });
  }

  private _remember(user: User, project: OpenProject): Promise<void> {
    const entry = {
      id: project.id,
      name: project.name,
      location: project.location,
      ref: project.ref,
      openedAt: new Date().toISOString(),
    };
    return this._updateRecent((store) => {
      store[user.id] = [
        entry,
        ...(store[user.id] ?? []).filter((item) => item.id !== project.id),
      ].slice(0, MAX_RECENT);
    });
  }

  /** Read, change and write the recent projects one at a time: two opens never lose a list. */
  private _updateRecent(change: (store: RecentStore) => void): Promise<void> {
    return this._recentLock.run('recent', async () => {
      const store = await this._readRecent();
      change(store);
      await this._writeRecent(store);
    });
  }

  private get _recentFile(): string {
    return join(this._env.dataDir, 'recent-projects.json');
  }

  private async _readRecent(): Promise<RecentStore> {
    if (!existsSync(this._recentFile)) return {};
    try {
      return JSON.parse(await readFile(this._recentFile, 'utf8')) as RecentStore;
    } catch (error) {
      this._logger.warn(`Ignoring unreadable ${basename(this._recentFile)}`, error);
      return {};
    }
  }

  private async _writeRecent(store: RecentStore): Promise<void> {
    await mkdir(this._env.dataDir, { recursive: true });
    const temp = `${this._recentFile}.${randomBytes(4).toString('hex')}.tmp`;
    try {
      await writeFile(temp, `${JSON.stringify(store, null, 2)}\n`);
      await rename(temp, this._recentFile);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }
}
