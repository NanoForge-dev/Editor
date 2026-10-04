import {
  type Disposable,
  type EngineFeatures,
  type EngineFrameStats,
  type EngineNetworkStats,
  type EngineNetworkTrace,
  type EngineSystemStats,
  type EngineWorld,
  type GameEvent,
  ObservableValue,
} from '@nanoforge-dev/editor-sdk';

export type GameSource = 'client' | 'server';

/** One sampling window of the profiler. */
export interface FrameSample {
  /** When it arrived (ms since epoch). */
  readonly time: number;
  readonly stats: EngineFrameStats;
  /** The latest system timings when the window ended, when the engine sends them. */
  readonly systems?: EngineSystemStats;
}

export interface Packet extends EngineNetworkTrace {
  readonly id: number;
}

/** What one game (the client or the server) reported during the run. */
export interface SourceRecord {
  frames: FrameSample[];
  packets: Packet[];
  network: EngineNetworkStats[];
  /** Packets the engine left out of the list (rate limit, sampling). */
  untraced: number;
  world: EngineWorld | undefined;
}

export const LIMITS = {
  /** Two minutes of 250 ms windows. */
  frames: 480,
  packets: 2000,
  /** Two minutes of one-second totals. */
  network: 120,
} as const;

/** What each inspector asks the engine for, while it is shown. */
export const FEATURES = {
  profiler: { frameStats: { intervalMs: 250 }, ecsSystemStats: { intervalMs: 250 } },
  network: { networkTrace: { maxPerSecond: 200, maxBytes: 512 } },
  world: { ecsWorld: { intervalMs: 250 } },
} as const satisfies Record<string, EngineFeatures>;

export type Inspector = keyof typeof FEATURES;

const emptyRecord = (): SourceRecord => ({
  frames: [],
  packets: [],
  network: [],
  untraced: 0,
  world: undefined,
});

/** A new list with the item, the oldest dropped over the limit (views compare lists by identity). */
const push = <T>(list: readonly T[], item: T, limit: number): T[] => [
  ...list.slice(Math.max(list.length + 1 - limit, 0)),
  item,
];

/** The part of the runtime service the recorder uses. */
export interface RecorderRuntime {
  onEvent(listener: (event: GameEvent) => void): Disposable;
  useFeatures(features: EngineFeatures): Disposable;
  /** The worlds already sent in this run (the engine sends one again only when it changes). */
  lastWorlds?(): readonly GameEvent[];
}

/**
 * Keeps what the running games report to the inspectors: frame windows, system timings,
 * packets, network totals and the world, per game. Features are asked for while an inspector
 * needs them (`acquire`), and a new run starts from nothing (`reset`).
 */
export class Recorder implements Disposable {
  private _records = new Map<GameSource, SourceRecord>();
  private readonly _revision = new ObservableValue(0);
  private readonly _uses = new Map<Inspector, { count: number; request?: Disposable }>();
  private _runtime: RecorderRuntime | undefined;
  private _listener: Disposable | undefined;
  private _systems = new Map<GameSource, EngineSystemStats>();
  private _nextPacket = 0;
  private _now: () => number;

  /** Bumped when anything recorded changes. */
  readonly revision = this._revision.readonly();

  constructor(now: () => number = Date.now) {
    this._now = now;
  }

  /** Games that reported something, the client first. */
  get sources(): GameSource[] {
    return (['client', 'server'] as const).filter((source) => this._records.has(source));
  }

  record(source: GameSource): SourceRecord | undefined {
    return this._records.get(source);
  }

  /** Follows the runtime of the open project (undefined: none). */
  setRuntime(runtime: RecorderRuntime | undefined): void {
    this._listener?.dispose();
    for (const use of this._uses.values()) {
      use.request?.dispose();
      delete use.request;
    }
    this._runtime = runtime;
    this._listener = runtime?.onEvent((event) => this.handle(event));
    for (const event of runtime?.lastWorlds?.() ?? []) this.handle(event);
    for (const [inspector, use] of this._uses) {
      if (runtime && use.count > 0) use.request = runtime.useFeatures(FEATURES[inspector]);
    }
  }

  /** Asks the engine for an inspector's data until disposed (counted: several views can ask). */
  acquire(inspector: Inspector): Disposable {
    const use = this._uses.get(inspector) ?? { count: 0 };
    this._uses.set(inspector, use);
    if (use.count++ === 0 && this._runtime)
      use.request = this._runtime.useFeatures(FEATURES[inspector]);
    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        if (--use.count > 0) return;
        use.request?.dispose();
        delete use.request;
      },
    };
  }

  /** Forgets the last run (a new one starts). */
  reset(): void {
    this._records = new Map();
    this._systems.clear();
    this._bump();
  }

  handle({ source, event, args }: GameEvent): void {
    const payload = args[0];
    if (!payload || typeof payload !== 'object') return;
    const record = () => {
      let found = this._records.get(source);
      if (!found) this._records.set(source, (found = emptyRecord()));
      return found;
    };
    switch (event) {
      case 'frame-stats': {
        if (!this._uses.get('profiler')?.count) return;
        const systems = this._systems.get(source);
        const target = record();
        target.frames = push(
          target.frames,
          { time: this._now(), stats: payload as EngineFrameStats, ...(systems && { systems }) },
          LIMITS.frames,
        );
        break;
      }
      case 'ecs-system-stats': {
        this._systems.set(source, payload as EngineSystemStats);
        return;
      }
      case 'network-trace': {
        const target = record();
        target.packets = push(
          target.packets,
          { ...(payload as EngineNetworkTrace), id: this._nextPacket++ },
          LIMITS.packets,
        );
        break;
      }
      case 'network-stats': {
        const stats = payload as EngineNetworkStats;
        const target = record();
        target.network = push(target.network, stats, LIMITS.network);
        target.untraced += stats.untraced;
        break;
      }
      case 'ecs-world':
        record().world = payload as EngineWorld;
        break;
      default:
        return;
    }
    this._bump();
  }

  dispose(): void {
    this.setRuntime(undefined);
    this._uses.clear();
  }

  private _bump(): void {
    this._revision.set(this._revision.get() + 1);
  }
}

/** Windows whose slowest tick went over the budget. */
export const isSpike = (sample: FrameSample, budgetMs: number): boolean =>
  sample.stats.tick.max > budgetMs;

export interface LibraryRow {
  readonly name: string;
  readonly avg: number;
  readonly max: number;
  /** Share of the average tick, 0 to 1. */
  readonly share: number;
}

/** Libraries of a window, the most expensive first. */
export const libraryRows = (stats: EngineFrameStats): LibraryRow[] =>
  Object.entries(stats.libraries)
    .map(([name, timing]) => ({
      name,
      avg: timing.avg,
      max: timing.max,
      share: stats.tick.avg > 0 ? Math.min(timing.avg / stats.tick.avg, 1) : 0,
    }))
    .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));

/** Bytes and packets per second of a totals window, in and out, both transports together. */
export const throughput = (
  stats: EngineNetworkStats,
): Record<'in' | 'out', { bytes: number; packets: number }> => {
  const seconds = Math.max(stats.windowMs, 1) / 1000;
  const sum = (direction: 'in' | 'out') => ({
    bytes: (stats.tcp[direction].bytes + stats.udp[direction].bytes) / seconds,
    packets: (stats.tcp[direction].packets + stats.udp[direction].packets) / seconds,
  });
  return { in: sum('in'), out: sum('out') };
};
