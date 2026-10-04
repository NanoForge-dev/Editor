import {
  type Disposable,
  DisposableStore,
  Emitter,
  type Event,
  type LogValue,
  type Observable,
  ObservableValue,
  createToken,
} from '@nanoforge-dev/editor-kernel';
import {
  type AppModel,
  type BuildStatus,
  type EngineFeatures,
  type EngineFrameStats,
  RUNTIME_PROTOCOL_VERSION,
  RuntimeContract,
  type RuntimeEvent,
} from '@nanoforge-dev/editor-protocol';

import { GameClientRunner } from '../client/game-client-runner';
import type { GameClientModule } from '../client/game-client-runner.type';
import { checkCompatibility } from '../compatibility/check-compatibility';
import type { GameCompatibility } from '../compatibility/game-compatibility.type';
import { mergeFeatures } from '../compatibility/merge-features';
import { SourceMaps } from '../source-map/source-maps';
import type { SourceLocation } from '../source-map/source-maps.type';
import { PlayError } from './play.exception';
import type {
  GameEvent,
  PlayMode,
  PlaySession,
  PlayState,
  RuntimeLog,
  RuntimeServiceOptions,
} from './runtime-service.type';

const IDLE: PlaySession = {
  state: 'idle',
  mode: undefined,
  apps: [],
  controllable: false,
  compatibility: [],
};

/** What the editor itself asks every game for (plugins add theirs with `useFeatures`). */
const EDITOR_FEATURES: EngineFeatures = { frameStats: { intervalMs: 1000 } };
const ACTIVE: readonly PlayState[] = ['building', 'starting', 'running', 'paused', 'stopping'];

export const isPlaying = (state: PlayState): boolean => ACTIVE.includes(state);

/**
 * Builds and plays the games of a project: the client runs in the Game screen of the editor,
 * the server in a process of the editor server. Plugins observe the session, listen to game
 * events and send commands through it.
 */
export class RuntimeService implements Disposable {
  /** Bridge protocol version the editor speaks. */
  readonly protocolVersion = RUNTIME_PROTOCOL_VERSION;

  private readonly _session = new ObservableValue<PlaySession>(IDLE);
  private readonly _builds = new ObservableValue<ReadonlyMap<string, BuildStatus>>(new Map());
  private readonly _onLog = new Emitter<RuntimeLog>();
  private readonly _onEvent = new Emitter<GameEvent>();
  /** The last `ecs-world` of each game: the engine sends it again only when it changes. */
  private readonly _worlds = new Map<string, GameEvent>();
  private readonly _onServerStateChange = new Emitter<[string, number | null | undefined]>();
  private readonly _host = new ObservableValue<HTMLElement | undefined>(undefined);
  private readonly _store = new DisposableStore();
  private readonly _engineStates = new Map<string, string>();
  private readonly _hellos = new Map<string, { protocolVersion?: number }>();
  private readonly _featureRequests = new Set<EngineFeatures>([EDITOR_FEATURES]);
  private readonly _frameStats = new ObservableValue<ReadonlyMap<string, EngineFrameStats>>(
    new Map(),
  );
  private _stage: HTMLElement | undefined;
  private _client: { app: string; runner: GameClientRunner } | undefined;
  private _server: string | undefined;
  private _serverBridged = false;
  private _run = 0;
  private readonly _sourceMaps: SourceMaps;

  readonly onLog: Event<RuntimeLog> = this._onLog.event;
  readonly onEvent: Event<GameEvent> = this._onEvent.event;

  constructor(private readonly _options: RuntimeServiceOptions) {
    this._sourceMaps = new SourceMaps({
      projectId: _options.projectId,
      apps: _options.apps,
      origin: _options.origin ?? globalThis.location?.origin ?? '',
      ...(_options.fetchText && { fetchText: _options.fetchText }),
    });
    this._store.add(
      _options.rpc.subscribe(RuntimeContract, 'events', { project: _options.projectId }, (event) =>
        this._onServerEvent(event),
      ),
    );
    void this._api
      .status({ project: _options.projectId })
      .then(({ builds }) => this._builds.set(new Map(builds.map((build) => [build.app, build]))))
      .catch(() => undefined);
  }

  get session(): Observable<PlaySession> {
    return this._session.readonly();
  }

  /** Last build of each app. */
  get builds(): Observable<ReadonlyMap<string, BuildStatus>> {
    return this._builds.readonly();
  }

  /**
   * The project file behind a position in a built game bundle (a stack frame), through the
   * bundle's source map. `file` is the bundle's URL (client) or path (server). Undefined when
   * the build has no source map or the position is not in a project file.
   */
  sourceLocation(file: string, line: number, column?: number): Promise<SourceLocation | undefined> {
    return this._sourceMaps.locate(file, line, column);
  }

  /** Latest frame stats of each running game, keyed `client` / `server`. */
  get frameStats(): Observable<ReadonlyMap<string, EngineFrameStats>> {
    return this._frameStats.readonly();
  }

  /**
   * Asks the running games (and the next ones) for engine features: frame stats, logs,
   * network traces. Requests of the editor and plugins are merged; dispose to withdraw.
   */
  /**
   * The live world a game last sent in this run (`ecs-world`). A listener that starts while
   * the game is paused gets no event (a world that does not change is not sent again): it
   * reads this one first.
   */
  lastWorlds(): readonly GameEvent[] {
    return [...this._worlds.values()];
  }

  useFeatures(features: EngineFeatures): Disposable {
    const request = { ...features };
    this._featureRequests.add(request);
    this._sendWelcomes();
    return {
      dispose: () => {
        if (this._featureRequests.delete(request)) this._sendWelcomes();
      },
    };
  }

  /** Element hosting the client game (set by the Game screen). */
  get host(): Observable<HTMLElement | undefined> {
    return this._host.readonly();
  }

  /**
   * The Game screen gives the element the client shows in. Games render in a stage element
   * owned by the service and moved between views, so a game keeps running (and keeps its
   * canvas) while the Game screen is hidden.
   */
  attach(host: HTMLElement): Disposable {
    if (!this._stage) {
      this._stage = host.ownerDocument.createElement('div');
      this._stage.dataset.nfGameStage = '';
      this._stage.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden';
    }
    host.append(this._stage);
    this._host.set(host);
    return {
      dispose: () => {
        if (this._host.get() !== host) return;
        this._stage?.remove();
        this._host.set(undefined);
      },
    };
  }

  /** Mode `play` uses by default for this project. */
  defaultMode(): PlayMode {
    const setting = this._options.playMode?.() ?? 'auto';
    if (setting !== 'auto') return setting;
    return this._app('server') ? 'server+client' : 'client';
  }

  /** Builds then starts the games of the mode. Resolves once they run (or crashed). */
  async play(mode: PlayMode = this.defaultMode()): Promise<void> {
    if (isPlaying(this._session.get().state)) return;
    const run = ++this._run;
    const client = mode === 'server' ? undefined : this._app('client');
    const server = mode === 'client' ? undefined : this._app('server');
    const apps = [server, client].flatMap((app) => (app ? [app.id] : []));
    this._engineStates.clear();
    this._hellos.clear();
    this._worlds.clear();
    this._frameStats.set(new Map());
    this._set({ state: 'building', mode, apps, controllable: false, compatibility: [] });
    try {
      if (mode !== 'server' && !client) throw new PlayError('This project has no client app');
      if (mode !== 'client' && !server) throw new PlayError('This project has no server app');
      const statuses = await this._api.build({ project: this._options.projectId, apps });
      const failed = statuses.filter((status) => status.state === 'error');
      if (failed.length) {
        throw new PlayError(
          'The game has build errors',
          failed.flatMap((status) => status.diagnostics),
        );
      }
      if (run !== this._run) return;
      this._set({ state: 'starting' });
      if (server) await this._startServer(server, run);
      if (client && run === this._run) await this._startClient(client, run);
      if (run !== this._run) return;
      await this._hellosOf([
        ...(server ? ['server' as const] : []),
        ...(client ? ['client' as const] : []),
      ]);
      if (run !== this._run) return;
      const compatibility = this._compatibility();
      for (const check of compatibility) {
        if (check.message) this._log(check.source, check.app, 'warn', check.message);
      }
      this._set({ state: 'running', controllable: this._controllable(), compatibility });
    } catch (error) {
      if (run !== this._run) return;
      await this._teardown();
      this._crash(error);
    }
  }

  pause(): void {
    this.send('pause');
  }

  resume(): void {
    this.send('resume');
  }

  /** Runs one tick of every paused game. */
  step(): void {
    this.send('step');
  }

  /** Stops every game; resolves once they stopped. */
  async stop(): Promise<void> {
    const { state } = this._session.get();
    if (state === 'idle' || state === 'stopping') return;
    this._run++;
    if (state === 'crashed') {
      this._set(IDLE);
      return;
    }
    this._set({ state: 'stopping' });
    await this._teardown();
    this._frameStats.set(new Map());
    this._set(IDLE);
  }

  async restart(): Promise<void> {
    const mode = this._session.get().mode;
    await this.stop();
    await this.play(mode);
  }

  /** Sends an editor → engine event to the running games (all by default). */
  send(event: string, args: readonly unknown[] = [], target: 'client' | 'server' | 'all' = 'all') {
    if (target !== 'server') this._client?.runner.send(event, args);
    if (target !== 'client' && this._server) {
      void this._api
        .sendServer({ project: this._options.projectId, app: this._server, event, args: [...args] })
        .catch((error: unknown) => this._options.logger.warn(`Could not send ${event}`, error));
    }
  }

  dispose(): void {
    this._run++;
    void this._teardown();
    this._store.dispose();
    this._onLog.dispose();
    this._onEvent.dispose();
    this._onServerStateChange.dispose();
  }

  private get _api() {
    return this._options.rpc.api(RuntimeContract);
  }

  /** The apps of a type that can be played. */
  playable(type: 'client' | 'server'): AppModel[] {
    return this._options.apps().filter((app) => app.type === type && app.outDir !== undefined);
  }

  /** The app Play starts for a type: the chosen one, else the first. */
  appFor(type: 'client' | 'server'): AppModel | undefined {
    const apps = this.playable(type);
    const selected = this._options.selectedApp?.(type);
    return apps.find((app) => app.id === selected) ?? apps[0];
  }

  private _app(type: 'client' | 'server'): AppModel | undefined {
    return this.appFor(type);
  }

  private _set(patch: Partial<PlaySession>): void {
    const next = { ...this._session.get(), ...patch };
    if (next.state !== 'crashed') {
      delete (next as { error?: string }).error;
      delete (next as { diagnostics?: unknown }).diagnostics;
    }
    this._session.set(next);
  }

  private _crash(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this._set({
      state: 'crashed',
      controllable: false,
      error: message,
      ...(error instanceof PlayError && error.diagnostics && { diagnostics: error.diagnostics }),
    });
    this._options.logger.error(`Game stopped: ${message}`);
  }

  /** How each playing game and the editor understand each other, from the hellos received. */
  private _compatibility(): GameCompatibility[] {
    return [
      ...(this._server
        ? [checkCompatibility('server', this._server, this._hellos.get('server'))]
        : []),
      ...(this._client
        ? [checkCompatibility('client', this._client.app, this._hellos.get('client'))]
        : []),
    ];
  }

  /**
   * Waits for the hello of each game, for a short while: one that never says it has no editor
   * bridge, and is played without pause.
   */
  private _hellosOf(sources: readonly ('client' | 'server')[]): Promise<void> {
    const missing = () => sources.some((source) => !this._hellos.has(source));
    if (!missing()) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        listener.dispose();
        resolve();
      };
      const timer = setTimeout(done, this._options.helloTimeoutMs ?? 1500);
      const listener = this._onEvent.event(({ event }) => {
        if (event === 'hello' && !missing()) done();
      });
    });
  }

  private _controllable(): boolean {
    return (!this._client || this._client.runner.bridged) && (!this._server || this._serverBridged);
  }

  private async _startServer(app: AppModel, run: number): Promise<void> {
    this._server = app.id;
    this._serverBridged = false;
    const started = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new PlayError('The game server did not start in time')),
        this._options.serverStartTimeoutMs ?? 15_000,
      );
      const listener = this._onServerState((state, exitCode) => {
        if (state === 'running' || state === 'exited' || run !== this._run) {
          clearTimeout(timer);
          listener.dispose();
          if (state === 'exited') {
            reject(new PlayError(`The game server exited (code ${exitCode ?? 'unknown'})`));
          } else resolve();
        }
      });
    });
    started.catch(() => undefined);
    await Promise.all([
      this._api.startServer({
        project: this._options.projectId,
        app: app.id,
        overrides: this._options.envOverrides?.() ?? {},
      }),
      started,
    ]);
  }

  private async _startClient(app: AppModel, run: number): Promise<void> {
    if (!this._host.get()) await this._waitForHost();
    const [manifest, env] = await Promise.all([
      this._api.manifest({ project: this._options.projectId, app: app.id }),
      this._api.env({
        project: this._options.projectId,
        app: app.id,
        overrides: this._options.envOverrides?.() ?? {},
      }),
    ]);
    if (run !== this._run) return;
    const runner = new GameClientRunner({
      importModule:
        this._options.importModule ??
        ((url) => import(/* @vite-ignore */ url) as Promise<GameClientModule>),
      onEvent: (event, args) => this._onGameEvent('client', app.id, event, args),
      onError: (error) => this._onClientError(app.id, error),
    });
    this._client = { app: app.id, runner };
    await runner.start({
      host: this._stage!,
      manifest,
      env,
      origin: this._options.origin ?? globalThis.location.origin,
    });
  }

  private _waitForHost(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        subscription();
        reject(new PlayError('Open the Game screen to play the client'));
      }, 10_000);
      const subscription = this._host.subscribe((host) => {
        if (!host) return;
        clearTimeout(timer);
        queueMicrotask(() => subscription());
        resolve();
      });
    });
  }

  private async _teardown(): Promise<void> {
    const client = this._client;
    const server = this._server;
    this._client = undefined;
    this._server = undefined;
    await Promise.all([
      client?.runner.stop().then((clean) => {
        if (clean) return;
        this._options.logger.warn(
          client.runner.bridged
            ? 'The game client did not stop in time; use Run > Reload editor runtime if it keeps running.'
            : "This game's engine cannot be stopped by the editor (no editor bridge): it keeps running hidden until Run > Reload editor runtime. Update the NanoForge engine to fix it.",
        );
      }),
      server &&
        this._api
          .stopServer({ project: this._options.projectId, app: server })
          .catch((error: unknown) =>
            this._options.logger.warn('Could not stop the game server', error),
          ),
    ]);
  }

  private _onServerState(listener: (state: string, exitCode?: number | null) => void): Disposable {
    return this._onServerStateChange.event(([state, code]) => listener(state, code));
  }

  private _onServerEvent(event: RuntimeEvent): void {
    switch (event.type) {
      case 'build': {
        const builds = new Map(this._builds.get());
        builds.set(event.status.app, event.status);
        this._builds.set(builds);
        if (event.status.state !== 'building') this._sourceMaps.invalidate(event.status.app);
        return;
      }
      case 'log':
        if (event.source === 'server') {
          const level =
            event.stream !== 'stderr'
              ? 'info'
              : /\b(error|exception|uncaught|fatal|panic)\b|^\s+at\s/i.test(event.text)
                ? 'error'
                : 'warn';
          this._log('server', event.app, level, event.text);
        } else {
          const level = /^\s*error\b/i.test(event.text)
            ? 'error'
            : /^\s*warn(ing)?\b/i.test(event.text)
              ? 'warn'
              : 'info';
          this._log(event.source, event.app, level, event.text);
        }
        return;
      case 'bridge':
        if (this._session.get().apps.includes(event.app)) {
          if (event.event === 'hello') this._serverBridged = true;
          this._onGameEvent('server', event.app, event.event, event.args);
        }
        return;
      case 'server':
        if (event.app !== this._server) return;
        this._onServerStateChange.fire([event.state, event.exitCode]);
        if (event.state === 'exited' && ['running', 'paused'].includes(this._session.get().state)) {
          const run = ++this._run;
          void this._teardown().then(() => {
            if (run === this._run)
              this._crash(new PlayError(`The game server exited (code ${event.exitCode ?? '?'})`));
          });
        }
        return;
    }
  }

  private _onGameEvent(
    source: 'client' | 'server',
    app: string,
    event: string,
    args: unknown[],
  ): void {
    if (event === 'hello') {
      this._hellos.set(source, (args[0] as { protocolVersion?: number } | undefined) ?? {});
      this._sendWelcome(source);
      if (this._session.get().state === 'running') {
        this._set({ controllable: this._controllable(), compatibility: this._compatibility() });
      }
    }
    if (event === 'frame-stats' && args[0]) {
      const stats = new Map(this._frameStats.get());
      stats.set(source, args[0] as EngineFrameStats);
      this._frameStats.set(stats);
    }
    if (event === 'log' && source === 'client') {
      const { level, message, values, caller } = (args[0] ?? {}) as {
        level?: string;
        message?: string;
        values?: unknown;
        caller?: string;
      };
      const frame = typeof caller === 'string' ? /^(.+?):(\d+):(\d+)$/.exec(caller) : null;
      this._onLog.fire({
        source: 'client',
        app,
        level: level === 'error' || level === 'warn' || level === 'debug' ? level : 'info',
        text: String(message ?? ''),
        ...(Array.isArray(values) && { values: values as LogValue[] }),
        ...(frame && {
          location: { file: frame[1]!, line: Number(frame[2]), column: Number(frame[3]) },
        }),
      });
    }
    if (event === 'state' && typeof args[0] === 'string') {
      this._engineStates.set(`${source}:${app}`, args[0]);
      this._syncPause();
    }
    if (event === 'ecs-world') this._worlds.set(source, { source, app, event, args });
    this._onEvent.fire({ source, app, event, args });
  }

  private _sendWelcomes(): void {
    for (const source of this._hellos.keys()) this._sendWelcome(source as 'client' | 'server');
  }

  /**
   * Answers the hello of a game with the protocol version and the merged features. Console
   * output is forwarded by clients only (with the logged values, when the engine can send
   * them): the output of game servers is already streamed.
   */
  private _sendWelcome(source: 'client' | 'server'): void {
    const features = mergeFeatures([...this._featureRequests]);
    const welcome = {
      protocolVersion: this.protocolVersion,
      features: { ...features, logs: source === 'client' ? { values: true } : false },
    };
    this.send('welcome', [welcome], source);
  }

  /** The session is paused when every game reports it is paused. */
  private _syncPause(): void {
    const { state } = this._session.get();
    if (state !== 'running' && state !== 'paused') return;
    const states = [...this._engineStates.values()];
    const paused = states.length > 0 && states.every((value) => value === 'paused');
    this._set({ state: paused ? 'paused' : 'running' });
  }

  private _onClientError(app: string, error: unknown): void {
    const text = error instanceof Error ? (error.stack ?? error.message) : String(error);
    this._log('client', app, 'error', text);
  }

  private _log(
    source: RuntimeLog['source'],
    app: string,
    level: RuntimeLog['level'],
    text: string,
  ) {
    if (!text.trim()) return;
    this._onLog.fire({ source, app, level, text });
  }
}

export const RuntimeServiceToken = createToken<RuntimeService>('runtime.service');
