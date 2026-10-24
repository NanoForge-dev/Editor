/** Anything with a zod-like `parse`; zod schemas satisfy it. */
export interface Validator<T> {
  parse(value: unknown): T;
}

export interface ExtensionPoint<T> {
  readonly id: string;
  readonly validator: Validator<T> | undefined;
  /** When false, at most one contribution is kept active: the highest priority one. */
  readonly multiple: boolean;
  /** @internal phantom type marker */
  readonly __type?: T;
}

export interface ExtensionPointOptions<T> {
  validator?: Validator<T>;
  multiple?: boolean;
}

export interface Contribution<T> {
  readonly value: T;
  /** Name of the contributing plugin (or `core`). */
  readonly owner: string;
  readonly priority: number;
  readonly seq: number;
}

export interface ContributeOptions {
  owner: string;
  priority?: number;
}
