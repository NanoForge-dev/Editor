export class PluginActivationError extends Error {
  constructor(
    readonly plugin: string,
    cause: unknown,
  ) {
    super(`Plugin "${plugin}" failed to activate: ${String(cause)}`, { cause });
    this.name = 'PluginActivationError';
  }
}
