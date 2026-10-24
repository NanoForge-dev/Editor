/** Optional engine features the editor asks for in its `welcome` (engine `EditorFeatures`). */
export interface EngineFeatures {
  frameStats?: { intervalMs: number };
  /** Console output of the game; `values` also asks for the logged values and their call site. */
  logs?: boolean | { values?: boolean };
  /**
   * Network packets (`network-trace` events, each with the first `maxBytes` bytes when given)
   * and totals every second (`network-stats`).
   */
  networkTrace?: { sampleRate?: number; maxPerSecond?: number; maxBytes?: number };
  /** ECS live world (`ecs-world` events), sent when it changed, at most every `intervalMs`. */
  ecsWorld?: { intervalMs: number };
  /** Time spent in each ECS system (`ecs-system-stats` events) every `intervalMs`. */
  ecsSystemStats?: { intervalMs: number };
  /** The client's viewport (`viewport` events), at once and on every change. */
  viewport?: boolean;
  /** Loaded scenes and scene vars (`scenes` events), sent when they changed, at most every `intervalMs`. */
  scenes?: { intervalMs: number };
}

/** Engine `EditorScenes` (`@nanoforge-dev/scene`): the `scenes` event. */
export interface EngineScenes {
  /** The loaded scenes, root first, by id. */
  readonly loaded: readonly { readonly id: string; readonly params: EngineWorldValue }[];
  readonly vars: readonly {
    readonly key: string;
    readonly value: EngineWorldValue;
    /** The id of the scene it belongs to. */
    readonly owner?: string;
    readonly persistent: boolean;
  }[];
  /** Ids of the scenes the game can load. */
  readonly known: readonly string[];
}

/**
 * Engine `EditorViewport` (its `ViewportState`): a point `(x, y)` of the game is drawn at
 * `(contentLeft + originX + x * scaleX, contentTop + originY + y * scaleY)` CSS px of the game's
 * container.
 */
export interface EngineViewport {
  readonly designWidth: number;
  readonly designHeight: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly contentLeft: number;
  readonly contentTop: number;
  readonly originX: number;
  readonly originY: number;
  readonly visibleWidth: number;
  readonly visibleHeight: number;
}

/** Engine `EditorNetworkTrace`: one packet a game sent or received. */
export interface EngineNetworkTrace {
  direction: 'in' | 'out';
  transport: 'tcp' | 'udp';
  /** Server side: the client the packet goes to or comes from. */
  clientId?: string;
  size: number;
  /** First 16 bytes, hex encoded. */
  head: string;
  /** The first `maxBytes` bytes, hex encoded (engines that send them). */
  data?: string;
  /** ms since epoch. */
  time: number;
}

/** Engine `EditorNetworkStats`: totals of every packet over a window, traced or not. */
export interface EngineNetworkStats {
  windowMs: number;
  time: number;
  tcp: Record<'in' | 'out', { packets: number; bytes: number }>;
  udp: Record<'in' | 'out', { packets: number; bytes: number }>;
  /** Packets left out of the `network-trace` events. */
  untraced: number;
}

/** Engine `EditorSystemStats`: time per call of each ECS system over a window (ms). */
export interface EngineSystemStats {
  windowMs: number;
  systems: { index: number; name: string; calls: number; avg: number; max: number }[];
}

/** A JSON view of a component value (engine `EditorValue`). */
export type EngineWorldValue =
  null | boolean | number | string | EngineWorldValue[] | { [key: string]: EngineWorldValue };

/** Engine `EditorWorld`: the running ECS world. */
export interface EngineWorld {
  entities: {
    id: number;
    /** The id of the scene that spawned it (`EcsScene` of `@nanoforge-dev/ecs/scene`). */
    scene?: string;
    components: { name: string; value: Record<string, EngineWorldValue> }[];
  }[];
  systems: { index: number; name: string; enabled: boolean }[];
}

/** Engine `EditorFrameStats`: tick timings over a sampling window (ms). */
export interface EngineFrameStats {
  windowMs: number;
  ticks: number;
  tps: number;
  tick: { avg: number; max: number };
  libraries: Record<string, { avg: number; max: number }>;
}
