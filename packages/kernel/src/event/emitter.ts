import { type Disposable, type DisposableStore, toDisposable } from '../lifecycle/disposable';

export type Listener<T> = (event: T) => void;

/** Subscribes a listener; the returned disposable unsubscribes it. */
export type Event<T> = (listener: Listener<T>, disposables?: DisposableStore) => Disposable;

export type ListenerErrorHandler = (error: unknown) => void;

let listenerErrorHandler: ListenerErrorHandler = (error) => {
  console.error('[nanoforge-editor] Uncaught error in event listener', error);
};

/** Sets where errors thrown by listeners are reported (they never break `fire`). */
export const setListenerErrorHandler = (handler: ListenerErrorHandler): void => {
  listenerErrorHandler = handler;
};

export interface EmitterOptions {
  /** Called when the first listener subscribes (lazy upstream subscription). */
  onFirstListenerAdd?: () => void;
  /** Called when the last listener unsubscribes. */
  onLastListenerRemove?: () => void;
}

export class Emitter<T> implements Disposable {
  private _listeners = new Set<{ fn: Listener<T> }>();
  private _disposed = false;
  private _event: Event<T> | undefined;

  constructor(private readonly _options: EmitterOptions = {}) {}

  get event(): Event<T> {
    this._event ??= (listener, disposables) => {
      if (this._disposed) return toDisposable(() => undefined);
      const entry = { fn: listener };
      if (this._listeners.size === 0) this._options.onFirstListenerAdd?.();
      this._listeners.add(entry);
      const subscription = toDisposable(() => {
        if (!this._listeners.delete(entry)) return;
        if (this._listeners.size === 0) this._options.onLastListenerRemove?.();
      });
      disposables?.add(subscription);
      return subscription;
    };
    return this._event;
  }

  get hasListeners(): boolean {
    return this._listeners.size > 0;
  }

  fire(event: T): void {
    for (const entry of [...this._listeners]) {
      if (!this._listeners.has(entry)) continue;
      try {
        entry.fn(event);
      } catch (error) {
        listenerErrorHandler(error);
      }
    }
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    if (this._listeners.size) this._options.onLastListenerRemove?.();
    this._listeners.clear();
  }
}
