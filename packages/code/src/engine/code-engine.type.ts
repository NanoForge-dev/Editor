import { type Node, type Project, type SourceFile } from 'ts-morph';

import { type EditBuilder } from './edit-builder';
import type { NodeRef, SourceText } from './engine.type';
import {
  type literalToValue,
  type quoteStyle,
  type readExportedLiteral,
  type valueToLiteral,
} from './literals';

export interface AnalyzeContext {
  readonly literals: {
    readonly literalToValue: typeof literalToValue;
    readonly valueToLiteral: typeof valueToLiteral;
    readonly readExportedLiteral: typeof readExportedLiteral;
    readonly quoteStyle: typeof quoteStyle;
  };
  readonly path: string;
  readonly file: SourceFile;
  readonly project: Project;
  readonly text: string;
  /** Stable reference of a node for models returned to the main thread. */
  ref(node: Node): NodeRef;
  /** Node at a reference, if the file still has it. */
  resolve(ref: NodeRef): Node | undefined;
  /**
   * How this file (or `fromPath`) imports another project file: by package name when a
   * `tsconfig.json` `paths` pattern maps it (`@me/shared/components/player`), else a relative
   * path. No extension.
   */
  moduleSpecifier(targetPath: string, fromPath?: string): string;
}

export interface TransformContext extends AnalyzeContext {
  readonly edit: EditBuilder;
}

export type Analyzer = (context: AnalyzeContext, args: unknown) => unknown;
export type Transformer = (context: TransformContext, op: unknown) => void;

export interface CodeEngineOptions {
  /** Fetches type declarations (`node_modules/<pkg>/…`) of a bare import, once per module. */
  readonly resolveTypes?: (module: string, from: string) => Promise<readonly SourceText[]>;
}
