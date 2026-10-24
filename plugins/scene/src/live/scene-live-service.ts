/**
 * Live mode (spec: "Live mode"): the loaded scenes and the vars of the running games, and the
 * commands that change them (the running game only).
 */
import {
  type Disposable,
  DisposableStore,
  type EngineScenes,
  type Observable,
  ObservableValue,
  type PluginContext,
  RuntimeServiceToken,
  createToken,
  isPlaying,
} from '@nanoforge-dev/editor-sdk';

const INTERVAL_MS = 200;

/** The scenes of one running game. */
export interface LiveScenes extends EngineScenes {
  readonly source: 'client' | 'server';
  /** App id. */
  readonly app: string;
}

export class SceneLiveService implements Disposable {
  private readonly _store = new DisposableStore();
  private readonly _session = new DisposableStore();
  private readonly _playing = new ObservableValue(false);
  private readonly _games = new ObservableValue<readonly LiveScenes[]>([]);
  private _watchers = 0;
  private _features: Disposable | undefined;

  constructor(private readonly _context: PluginContext) {
    this._store.add(this._session);
    const runtime = _context.services.tryGet(RuntimeServiceToken);
    if (!runtime) return;
    this._store.add({
      dispose: runtime.session.subscribe((session) => {
        const playing = isPlaying(session.state);
        if (playing === this._playing.get()) return;
        this._playing.set(playing);
        if (playing) this._start();
        else this._stop();
      }),
    });
  }

  get playing(): Observable<boolean> {
    return this._playing.readonly();
  }

  /** The scenes of each running game that uses the scene library. */
  get games(): Observable<readonly LiveScenes[]> {
    return this._games.readonly();
  }

  /** The running game of an app, if it sent its scenes. */
  game(app: string | undefined): LiveScenes | undefined {
    return this._games.get().find((game) => game.app === app);
  }

  /**
   * Asks the games for their scenes while a view shows them (a panel on screen): the engine
   * sends them only when asked.
   */
  watch(): Disposable {
    this._watchers++;
    this._updateFeatures();
    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        this._watchers--;
        this._updateFeatures();
      },
    };
  }

  /** Moves a running game to a scene (its id), with params and a parent (an id, or "current"). */
  load(game: LiveScenes, id: string, params?: unknown, parent?: string): void {
    this._send(game, 'scenes-load', [id, params ?? null, ...(parent ? [parent] : [])]);
  }

  unload(game: LiveScenes, id: string): void {
    this._send(game, 'scenes-unload', [id]);
  }

  setVar(game: LiveScenes, key: string, value: unknown): void {
    this._send(game, 'scenes-set-var', [key, value]);
  }

  dispose(): void {
    this._features?.dispose();
    this._store.dispose();
  }

  private _send(game: LiveScenes, event: string, args: readonly unknown[]): void {
    this._context.services.tryGet(RuntimeServiceToken)?.send(event, args, game.source);
  }

  private _updateFeatures(): void {
    const runtime = this._context.services.tryGet(RuntimeServiceToken);
    const wanted = this._watchers > 0 && this._playing.get();
    if (wanted && !this._features && runtime)
      this._features = runtime.useFeatures({ scenes: { intervalMs: INTERVAL_MS } });
    else if (!wanted && this._features) {
      this._features.dispose();
      this._features = undefined;
    }
  }

  private _start(): void {
    const runtime = this._context.services.tryGet(RuntimeServiceToken);
    if (!runtime) return;
    this._updateFeatures();
    this._session.add(
      runtime.onEvent((event) => {
        if (event.event !== 'scenes') return;
        const scenes = event.args[0] as EngineScenes;
        const others = this._games.get().filter((game) => game.source !== event.source);
        this._games.set(
          [...others, { ...scenes, source: event.source, app: event.app }].sort((a, b) =>
            a.source.localeCompare(b.source),
          ),
        );
      }),
    );
  }

  private _stop(): void {
    this._session.clear();
    this._updateFeatures();
    this._games.set([]);
  }
}

export const SceneLiveServiceToken = createToken<SceneLiveService>('scene.live');
