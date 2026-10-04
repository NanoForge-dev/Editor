/**
 * A logged value as a JSON tree: a snapshot that can cross a bridge (game → editor) and be
 * shown expanded. The engine's editor bridge writes the same format.
 */
export type LogValue =
  | string
  | number
  | boolean
  | null
  | { readonly type: 'undefined' }
  /** Numbers JSON cannot carry: `NaN`, `Infinity`, `-Infinity`, `-0`. */
  | { readonly type: 'number'; readonly text: string }
  | { readonly type: 'bigint' | 'symbol' | 'function' | 'date'; readonly text: string }
  | {
      readonly type: 'error';
      readonly name: string;
      readonly message: string;
      readonly stack?: string;
    }
  | {
      readonly type: 'object';
      /** Constructor name, for instances of classes. */
      readonly name?: string;
      readonly entries: readonly (readonly [string, LogValue])[];
      /** Entries left out. */
      readonly more?: number;
    }
  | {
      readonly type: 'array';
      /** `Set`, `Float32Array`… for array-likes that are not arrays. */
      readonly name?: string;
      readonly length: number;
      readonly items: readonly LogValue[];
      readonly more?: number;
    }
  | {
      readonly type: 'map';
      readonly size: number;
      readonly entries: readonly (readonly [LogValue, LogValue])[];
      readonly more?: number;
    }
  /** A value already shown higher in the tree. */
  | { readonly type: 'circular' }
  /** A value deeper than the limit: only its summary is kept. */
  | { readonly type: 'cut'; readonly text: string };

export interface LogValueLimits {
  /** Nesting kept below the logged value (default 4). */
  readonly depth?: number;
  /** Entries kept per object, array or map (default 50). */
  readonly entries?: number;
  /** Values kept in the whole tree (default 500). */
  readonly nodes?: number;
  /** Characters kept per string (default 10 000). */
  readonly text?: number;
}
