import type {
  ClassDeclaration,
  FunctionDeclaration,
  Node,
  SourceFile,
  VariableDeclaration,
} from 'ts-morph';

import type { ItemRef } from '../schema/item-ref.schema';
import type { MetaSource } from '../schema/meta-file.schema';

export type ItemDeclaration = ClassDeclaration | FunctionDeclaration | VariableDeclaration;
export type ItemKind = 'class' | 'function' | 'const';

/** Where the extractor is, for owners. */
export interface OwnerContext {
  readonly file: SourceFile;
  /** Project path of the file. */
  readonly path: string;
  readonly source: MetaSource;
  /** The item folder of the app or library the file is in (`dir.components`, `dir.systems`). */
  readonly folder?: 'components' | 'systems';
  /** The item a node (usually an identifier) refers to, when its declaration is exported. */
  refOf(node: Node): ItemRef | undefined;
}

export interface OwnerInput {
  readonly declaration: ItemDeclaration;
  readonly kind: ItemKind;
  /** This owner's tags on the item, by name (without `@`). */
  readonly tags: Readonly<Record<string, readonly string[]>>;
  readonly context: OwnerContext;
}

/**
 * An owner of item data (ADR 0003), registered by a plugin's worker entry. It reads its own
 * tags, may infer untagged items, and returns its object for the item's owner key.
 */
export interface ItemOwner {
  /** The plugin's registry name, also the owner key: `@nanoforge/ecs`. */
  readonly name: string;
  /** The plugin's version (written in the meta's `owners`). */
  readonly version: string;
  /** Version of the owner object's shape. A change regenerates the metas. */
  readonly schema: number;
  /** The tags it owns, without `@`. */
  readonly tags: readonly string[];
  /** Checks the owner object (a zod schema fits). */
  readonly validate?: { safeParse(value: unknown): { success: boolean; error?: unknown } };
  /** Whether an export without this owner's tags is an item for it (inference). */
  infer?(input: OwnerInput): boolean;
  /** Members the owner describes itself: left out of `params` / `fields`. */
  claims?(input: OwnerInput): {
    readonly params?: readonly string[];
    readonly fields?: readonly string[];
  };
  /** The owner object, or undefined when the export isn't an item for this owner. */
  extract(input: OwnerInput): Record<string, unknown> | undefined;
}
