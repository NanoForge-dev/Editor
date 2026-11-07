export interface Disposable {
  dispose(): void;
}

export interface DisposableTracker {
  onCreate(disposable: Disposable): void;
  onDispose(disposable: Disposable): void;
}

let tracker: DisposableTracker | null = null;

/** Installs a tracker notified of every kernel disposable (leak detection in tests). */
export const setDisposableTracker = (value: DisposableTracker | null): void => {
  tracker = value;
};

export const isDisposable = (value: unknown): value is Disposable =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Partial<Disposable>).dispose === 'function';

class FunctionDisposable implements Disposable {
  private _fn: (() => void) | null;

  constructor(fn: () => void) {
    this._fn = fn;
    tracker?.onCreate(this);
  }

  dispose(): void {
    const fn = this._fn;
    if (!fn) return;
    this._fn = null;
    tracker?.onDispose(this);
    fn();
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}

/** Wraps a cleanup function; calling `dispose` more than once runs it only once. */
export const toDisposable = (fn: () => void): Disposable => new FunctionDisposable(fn);

/** Disposes every given disposable, collecting errors into an `AggregateError`. */
export const disposeAll = (disposables: Iterable<Disposable>): void => {
  const errors: unknown[] = [];
  for (const disposable of disposables) {
    try {
      disposable.dispose();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'Errors while disposing');
};

export const combineDisposables = (...disposables: Disposable[]): Disposable =>
  toDisposable(() => disposeAll(disposables));

/**
 * A collection of disposables disposed together (LIFO). Adding to a disposed store disposes
 * the new value immediately, so late registrations never leak.
 */
export class DisposableStore implements Disposable {
  private readonly _items = new Set<Disposable>();
  private _disposed = false;

  constructor() {
    tracker?.onCreate(this);
  }

  get isDisposed(): boolean {
    return this._disposed;
  }

  get size(): number {
    return this._items.size;
  }

  add<T extends Disposable>(disposable: T): T {
    if (this._disposed) {
      disposable.dispose();
      return disposable;
    }
    this._items.add(disposable);
    return disposable;
  }

  /** Removes without disposing. */
  delete(disposable: Disposable): void {
    this._items.delete(disposable);
  }

  /** Disposes the current items but keeps the store usable. */
  clear(): void {
    const items = [...this._items].reverse();
    this._items.clear();
    disposeAll(items);
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    tracker?.onDispose(this);
    this.clear();
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}
