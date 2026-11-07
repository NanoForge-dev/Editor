import type { ItemRef, NodeRef } from '@nanoforge-dev/editor-sdk';

/**
 * Types shared by the plugin's worker entry (analyzers, transformers, item owner) and its widgets.
 * Type-only: nothing here runs.
 */

/** The `@nanoforge/ecs` object of an item (ADR 0003). */
export type EcsItemData =
  | {
      type: 'component';
      /** The ECS registry key: the class's `name = "X"` field. */
      name: string;
      /** Found without `@component` (a class with a `name` field in a components folder). */
      inferred?: boolean;
    }
  | {
      type: 'system';
      /** One list per `getZipper([...])` (or `getComponents(X)`): item refs, or the code. */
      query: string[][];
      /** `ctx` libraries it uses: app, graphics, input, network… */
      uses: string[];
      inferred?: boolean;
    };

/** An argument of `new X(...)`. */
export interface ArgModel {
  readonly code: string;
  readonly start: number;
  readonly end: number;
  /** JSON value when the argument is a literal (an enum member gives its value). */
  readonly value?: unknown;
  /** `new Rect({ width: 30 })`: the class and its literal arguments (the 2D scene draws them). */
  readonly construct?: { readonly className: string; readonly args: readonly unknown[] };
}

/** `registry.addComponent(entity, new X(...))`. */
export interface ComponentUse {
  readonly node: NodeRef;
  /** The class, when the component is `new X(...)`. */
  readonly className?: string;
  /** The catalog item of the class, when it is exported by an app, library or package. */
  readonly item?: ItemRef;
  /** Project path of the class's file. */
  readonly source?: string;
  readonly args: readonly ArgModel[];
  /** The component expression, as written. */
  readonly code: string;
  /** False when the component isn't `new X(...)`: shown, not edited. */
  readonly editable: boolean;
}

/** `const paddle = registry.spawnEntity();` and its components. */
export interface EntityModel {
  /** The variable name, also the entity's name in the hierarchy. */
  readonly name: string;
  readonly node: NodeRef;
  readonly line: number;
  readonly components: readonly ComponentUse[];
}

/** A `spawnEntity()` the editor can't model (in a loop, a helper…): read-only. */
export interface CodeOnlyEntity {
  readonly line: number;
  readonly start: number;
  readonly end: number;
  /** The statement that spawns it. */
  readonly code: string;
}

/** `registry.addSystem(fn)`. */
export interface SystemUse {
  readonly node: NodeRef;
  /** The function name when it's an identifier. */
  readonly name?: string;
  readonly item?: ItemRef;
  readonly code: string;
}

export interface EntryModel {
  readonly path: string;
  /** `main` was found. */
  readonly found: boolean;
  /** The registry expression (`registry`). */
  readonly registry?: string;
  readonly entities: readonly EntityModel[];
  readonly codeOnly: readonly CodeOnlyEntity[];
  readonly systems: readonly SystemUse[];
  /** Why parts of the file can't be edited. */
  readonly problems: readonly string[];
}

/** The folder and item reference base of each source (like the catalog's roots). */
export interface EntryRoot {
  readonly path: string;
  readonly ref: string;
}

/**
 * Which function body holds the spawns: the app's `main` (the default), or a method of an
 * exported class (a scene's `setup`).
 */
export type EntryScope =
  | { readonly kind: 'main' }
  | { readonly kind: 'method'; readonly class: string; readonly method: string };

export interface EntryAnalyzeArgs {
  readonly roots: readonly EntryRoot[];
  readonly scope?: EntryScope;
}

/** An import a change needs: `import { name } from <specifier of path>`. */
export interface ImportNeed {
  readonly name: string;
  /** Project path of the file that exports it, or a package name (`@nanoforge-dev/input`). */
  readonly from: string;
}

/** An argument's new code: a JSON value (written as a literal) or code as is. */
export type ArgValue = { readonly value: unknown } | { readonly code: string };

export type EntryOp =
  | { readonly kind: 'addEntity'; readonly name?: string }
  | { readonly kind: 'removeEntity'; readonly entity: string }
  | { readonly kind: 'renameEntity'; readonly entity: string; readonly name: string }
  | { readonly kind: 'duplicateEntity'; readonly entity: string; readonly name?: string }
  | { readonly kind: 'moveEntity'; readonly entity: string; readonly before?: string }
  | {
      readonly kind: 'addComponent';
      readonly entity: string;
      readonly className: string;
      readonly args: readonly ArgValue[];
      readonly imports: readonly ImportNeed[];
    }
  | { readonly kind: 'removeComponent'; readonly entity: string; readonly index: number }
  | {
      readonly kind: 'moveComponent';
      readonly entity: string;
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly kind: 'setArgs';
      readonly entity: string;
      readonly index: number;
      /** New arguments by position; missing positions between are filled with `fill`. */
      readonly args: Readonly<Record<number, ArgValue>>;
      /** Each parameter's default, to fill positions before a set one. */
      readonly fill?: readonly ArgValue[];
      readonly imports?: readonly ImportNeed[];
    }
  | { readonly kind: 'addSystem'; readonly name: string; readonly imports: readonly ImportNeed[] }
  | { readonly kind: 'removeSystem'; readonly index: number }
  | { readonly kind: 'moveSystem'; readonly from: number; readonly to: number };

/** An `EntryOp` on a scope other than `main` (the transformer's input). */
export type ScopedEntryOp = EntryOp & { readonly scope?: EntryScope };
