/** Typed key of a service. `T` only exists at the type level. */
export interface ServiceToken<T> {
  readonly id: string;
  /** @internal phantom type marker */
  readonly __type?: T;
}

export const createToken = <T>(id: string): ServiceToken<T> => Object.freeze({ id });
