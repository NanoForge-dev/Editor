/**
 * Live mode (spec: "Live mode"): the world of the running games, linked to the code, and the
 * edits made while playing (changed in the game only, until "Apply to code").
 */

export type LiveSource = 'client' | 'server';

/** Engine `EditorWorld` (modules/ecs editor-world.ts). */
export interface EngineWorld {
  entities: {
    id: number;
    site?: { file: string; line: number; column: number };
    /** The id of the scene that spawned it (`EcsScene`). */
    scene?: string;
    components: { name: string; value: Record<string, unknown> }[];
  }[];
  systems: { index: number; name: string; enabled: boolean }[];
}

export interface LiveEntity {
  readonly id: number;
  /** The entity's variable in `main` (or in its scene's `setup`), when it is declared there. */
  readonly code?: string;
  /** The id of the scene that spawned it, when a scene did. */
  readonly scene?: string;
  /** Names its changes made while playing: `code`, or `scene:code` for a scene's entity. */
  readonly key?: string;
  /** Spawned by code the editor can't model (its line in the entry file). */
  readonly codeOnlyLine?: number;
  /** Spawned at runtime (by a system…): not in `main`. */
  readonly runtime: boolean;
  readonly components: readonly {
    readonly name: string;
    readonly value: Record<string, unknown>;
  }[];
}

export interface LiveInstance {
  readonly source: LiveSource;
  /** App id. */
  readonly app: string;
  readonly entities: readonly LiveEntity[];
  readonly systems: readonly {
    readonly index: number;
    readonly name: string;
    readonly enabled: boolean;
  }[];
}

export interface LiveSelection {
  readonly source: LiveSource;
  readonly id: number;
}
