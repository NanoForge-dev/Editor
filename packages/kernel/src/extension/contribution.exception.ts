export class ContributionError extends Error {
  constructor(
    readonly point: string,
    readonly owner: string,
    cause: unknown,
  ) {
    super(`Invalid contribution of "${owner}" to "${point}": ${String(cause)}`, { cause });
    this.name = 'ContributionError';
  }
}
