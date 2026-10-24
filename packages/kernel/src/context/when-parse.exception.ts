export class WhenParseError extends Error {
  constructor(
    readonly source: string,
    readonly position: number,
    message: string,
  ) {
    super(`Invalid when clause "${source}" at ${position}: ${message}`);
    this.name = 'WhenParseError';
  }
}
