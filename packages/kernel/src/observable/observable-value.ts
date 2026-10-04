import type { Listener } from '../event/emitter';
import type { Equality, Observable } from './observable';

/** A writable observable value. */
export class ObservableValue<T> implements Observable<T> {
  private readonly _subscribers = new Set<{ run: Listener<T> }>();

  constructor(
    private _value: T,
    private readonly _equals: Equality<T> = Object.is,
  ) {}

  get(): T {
    return this._value;
  }

  set(value: T): void {
    if (this._equals(this._value, value)) return;
    this._value = value;
    for (const subscriber of [...this._subscribers]) {
      if (this._subscribers.has(subscriber)) subscriber.run(value);
    }
  }

  update(fn: (value: T) => T): void {
    this.set(fn(this._value));
  }

  subscribe(run: Listener<T>): () => void {
    const subscriber = { run };
    this._subscribers.add(subscriber);
    run(this._value);
    return () => this._subscribers.delete(subscriber);
  }

  get subscriberCount(): number {
    return this._subscribers.size;
  }

  /** A read-only view, to expose without handing out `set`. */
  readonly(): Observable<T> {
    return { get: () => this.get(), subscribe: (run) => this.subscribe(run) };
  }
}
