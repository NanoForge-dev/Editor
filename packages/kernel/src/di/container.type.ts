import type { ServiceToken } from './service-token';

export interface ServiceAccessor {
  get<T>(token: ServiceToken<T>): T;
  tryGet<T>(token: ServiceToken<T>): T | undefined;
  getAll<T>(token: ServiceToken<T>): T[];
}

export type ServiceFactory<T> = (accessor: ServiceAccessor) => T;
export type ServiceDecorator<T> = (inner: T, accessor: ServiceAccessor) => T;

export interface ProvideOptions {
  /** Highest priority wins; on ties the latest registration wins. Default 0. */
  priority?: number;
}
