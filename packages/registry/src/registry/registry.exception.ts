import type { RegistryErrorCode } from './registry.type';

/** A failure with a reason a caller can act on (`code`) and a message for people. */
export class RegistryError extends Error {
  constructor(
    readonly code: RegistryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RegistryError';
  }
}
