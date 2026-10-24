export class CommandPreconditionError extends Error {
  constructor(
    readonly id: string,
    readonly when: string,
  ) {
    super(`Command "${id}" is not enabled (${when})`);
    this.name = 'CommandPreconditionError';
  }
}
