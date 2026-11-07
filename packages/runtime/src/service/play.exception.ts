import type { BuildDiagnostic } from '@nanoforge-dev/editor-protocol';

export class PlayError extends Error {
  constructor(
    message: string,
    readonly diagnostics?: readonly BuildDiagnostic[],
  ) {
    super(message);
  }
}
