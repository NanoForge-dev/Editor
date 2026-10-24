/** Thrown by transformers/analyzers for problems users should see (not bugs). */
export class CodeError extends Error {
  constructor(
    message: string,
    readonly path?: string,
    readonly start?: number,
  ) {
    super(message);
    this.name = 'CodeError';
  }
}
