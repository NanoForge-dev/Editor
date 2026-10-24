import type { TextEdit } from '@nanoforge-dev/editor-history';

export type { TextEdit };

/** A reference to a syntax node, stable while the file does not change around it. */
export interface NodeRef {
  /** `<path>:<kind>@<start>` */
  readonly id: string;
  readonly path: string;
  readonly kind: string;
  readonly start: number;
  readonly end: number;
}

export interface CodeDiagnostic {
  /** Project-relative file; empty for a problem that has no file (a failed build). */
  readonly path: string;
  /** Offset in the file's text; -1 when only `line` and `column` are known (build errors). */
  readonly start: number;
  readonly length: number;
  /** 1-based position, when the reporter knows it. */
  readonly line?: number;
  readonly column?: number;
  readonly message: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly code?: number | string;
  /** `typescript` or the analyzer/plugin that reported it. */
  readonly source: string;
}

/** A named declaration of a file, for outlines and "go to symbol". */
export interface CodeSymbol {
  readonly name: string;
  /** TypeScript's kind: `class`, `function`, `method`, `property`, `const`, `interface`… */
  readonly kind: string;
  /** The declaration that holds it (`Position` for a field of the class). */
  readonly container?: string;
  /** 1-based position of the name. */
  readonly line: number;
  readonly column: number;
}

export interface SourceText {
  readonly path: string;
  readonly text: string;
}
