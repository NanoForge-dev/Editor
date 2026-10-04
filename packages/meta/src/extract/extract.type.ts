import type { Node, SourceFile } from 'ts-morph';

import type { ItemOwner } from '../owner/item-owner.type';
import type { ItemRef } from '../schema/item-ref.schema';
import type { ItemMeta, MetaSource } from '../schema/meta-file.schema';

export interface MetaDiagnostic {
  readonly path: string;
  readonly start: number;
  readonly length: number;
  readonly message: string;
  readonly severity: 'warning' | 'info';
  /** `meta` or the owner that reported it. */
  readonly source: string;
}

export interface ExtractOptions {
  readonly source: MetaSource;
  /** Project path of the file. */
  readonly path: string;
  readonly owners: readonly ItemOwner[];
  /** The file is listed in a manifest's `items`: each of its exports is an item. */
  readonly listed?: boolean;
  /** The item folder of the app or library the file is in. */
  readonly folder?: 'components' | 'systems';
  /** Module of a declaration file: a package name, or the project path of a project file. */
  modulePath(file: SourceFile): string;
  /** The item a node refers to (for owners, e.g. the components a system queries). */
  refOf(node: Node): ItemRef | undefined;
}

export interface ExtractResult {
  readonly items: ItemMeta[];
  readonly diagnostics: MetaDiagnostic[];
}
