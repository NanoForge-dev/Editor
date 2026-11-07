/**
 * Types shared by the plugin's worker entry (analyzers, transformers) and its widgets.
 * Type-only: nothing here runs, except the ids.
 */

/** A param of a scene (`Scene<{ seed: number }>`), from its type argument. */
export interface SceneParam {
  readonly name: string;
  /** The type as written (`number`, `'easy' | 'hard'`). */
  readonly type: string;
  readonly optional: boolean;
  readonly description?: string;
}

/** A scene class of an app. */
export interface SceneModel {
  /** Its id: its key in `SceneLibrary`'s `scenes`, else its class name. */
  readonly id: string;
  readonly className: string;
  /** Project path of its file. */
  readonly path: string;
  /** Line of the class. */
  readonly line: number;
  /** Class name of its parent (`static parent`, its own or a base class's). */
  readonly parent?: string;
  /** Extends `EcsScene` (directly or through a base class). */
  readonly ecs: boolean;
  /** Has a `setup` method of its own (the ECS widgets edit it). */
  readonly ownSetup: boolean;
  /** The params type as written, if it has one (`{ seed: number }`). */
  readonly paramsType?: string;
  /** The params' fields, when the type is a type literal. */
  readonly params: readonly SceneParam[];
  /** The class's doc summary. */
  readonly description?: string;
  /** Tagged `@scene` (else found by its base class only). */
  readonly tagged: boolean;
  readonly side?: string;
  /** `@vars score, lives`. */
  readonly vars: readonly string[];
}

/** `new SceneLibrary({ initial, scenes })` in the entry file. */
export interface LibraryModel {
  /** Class name given as `initial`. */
  readonly initial?: string;
  /** The `scenes` map: id → class name. */
  readonly scenes: Readonly<Record<string, string>>;
  /** `scenes` is written (an object literal the editor can edit). */
  readonly hasScenes: boolean;
  readonly line: number;
}

export interface AppScenesModel {
  readonly scenes: readonly SceneModel[];
  /** `undefined` when the entry file creates no `SceneLibrary`. */
  readonly library?: LibraryModel;
  readonly problems: readonly string[];
}

export interface ScenesAnalyzeArgs {
  /** The app's folder: scenes are its classes (and those tagged `@scene`). */
  readonly root: string;
}

/** What a change of the entry file's `SceneLibrary` imports: a project path or a package. */
export type LibraryOp =
  | { readonly kind: 'addScene'; readonly className: string; readonly from: string }
  | { readonly kind: 'removeScene'; readonly className: string }
  | { readonly kind: 'setInitial'; readonly className: string; readonly from: string };

/** A change of a scene's file. `parent.from` is the path of the parent's file. */
export type SceneFileOp =
  | {
      readonly kind: 'setParent';
      readonly className: string;
      readonly parent?: { readonly className: string; readonly from: string };
    }
  | { readonly kind: 'removeClass'; readonly className: string };

/** Ranges of a file replaced by a text. */
export interface TextReplace {
  readonly ranges: readonly { readonly start: number; readonly end: number }[];
  readonly text: string;
}

/** The references of a class in one file. */
export interface ReferenceRange {
  readonly path: string;
  readonly ranges: readonly { readonly start: number; readonly end: number }[];
}
