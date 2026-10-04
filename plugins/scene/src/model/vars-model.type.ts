/** A scene var declared in `SceneVars` (`src/scene-vars.ts`). */
export interface VarModel {
  readonly name: string;
  /** As written: `number`, `'easy' | 'hard'`. */
  readonly type: string;
  readonly optional: boolean;
  readonly description?: string;
  /** `@default` as written. */
  readonly default?: string;
  readonly line: number;
}

/** A `vars.init/set/get/has/remove("key", …)` call with a string-literal key. */
export interface VarUse {
  readonly key: string;
  readonly kind: 'init' | 'set' | 'get' | 'has' | 'remove';
  readonly path: string;
  readonly line: number;
  /** The key's text, quotes excluded (what a rename replaces). */
  readonly start: number;
  readonly end: number;
  /** The class the call is in (a scene's `setup`). */
  readonly className?: string;
  /** Type of the value given to `init` / `set`, when it is a literal. */
  readonly valueType?: string;
}

export interface VarsModel {
  /** The file declaring `SceneVars`, if any. */
  readonly file?: string;
  readonly vars: readonly VarModel[];
  readonly uses: readonly VarUse[];
}

export interface VarsAnalyzeArgs {
  readonly root: string;
}

/** A change of `SceneVars`' declaration. */
export type VarsOp =
  | {
      readonly kind: 'addVar';
      readonly name: string;
      readonly type: string;
      readonly description?: string;
      readonly default?: string;
    }
  | {
      readonly kind: 'updateVar';
      readonly name: string;
      readonly rename?: string;
      readonly type?: string;
      readonly description?: string;
      readonly default?: string;
    }
  | { readonly kind: 'removeVar'; readonly name: string };
