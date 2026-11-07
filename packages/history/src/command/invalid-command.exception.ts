/**
 * A step of a grouped command no longer matches the state it left (an edit made in between):
 * what already ran was reverted, and the history drops the step instead of undoing it.
 */
export class InvalidCommandError extends Error {
  constructor(readonly command: string) {
    super(`${command} changed since: not undone`);
    this.name = 'InvalidCommandError';
  }
}
