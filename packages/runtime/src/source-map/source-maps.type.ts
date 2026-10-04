import type { AppModel } from '@nanoforge-dev/editor-protocol';

/** A position in a project file (1-based line and column). */
export interface SourceLocation {
  readonly path: string;
  readonly line: number;
  readonly column: number;
}

export interface SourceMapsOptions {
  readonly projectId: string;
  readonly apps: () => readonly AppModel[];
  /** Origin the build output is served from. */
  readonly origin: string;
  /** Reads a served file; undefined when it doesn't exist. */
  readonly fetchText?: (url: string) => Promise<string | undefined>;
}
