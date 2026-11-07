/** A change refused for a reason the user can act on. */
export class WorkspaceError extends Error {
  constructor(
    message: string,
    /** Files that stand in the way (the importers of a library being removed). */
    readonly paths: readonly string[] = [],
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}
