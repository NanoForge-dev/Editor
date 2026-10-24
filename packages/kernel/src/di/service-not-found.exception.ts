import type { ServiceToken } from './service-token';

export class ServiceNotFoundError extends Error {
  constructor(readonly token: ServiceToken<unknown>) {
    super(`No provider for service "${token.id}"`);
    this.name = 'ServiceNotFoundError';
  }
}
