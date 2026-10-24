export class CommandNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`Command "${id}" not found`);
    this.name = 'CommandNotFoundError';
  }
}
