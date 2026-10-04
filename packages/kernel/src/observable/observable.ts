import type { Event, Listener } from '../event/emitter';
import { type Disposable, toDisposable } from '../lifecycle/disposable';
import { ObservableValue } from './observable-value';

/**
 * A readable reactive value. `subscribe` follows the Svelte store contract (called immediately,
 * returns an unsubscriber), so `$observable` works in plugin templates without any adapter.
 */
export interface Observable<T> {
  get(): T;
  subscribe(run: Listener<T>): () => void;
}

export type ObservableValues<S extends readonly Observable<unknown>[]> = {
  [K in keyof S]: S[K] extends Observable<infer V> ? V : never;
};

/** Subscribes as a `Disposable`, optionally skipping the immediate call. */
export const observe = <T>(
  observable: Observable<T>,
  listener: Listener<T>,
  options: { immediate?: boolean } = {},
): Disposable => {
  let skip = options.immediate === false;
  const unsubscribe = observable.subscribe((value) => {
    if (skip) return;
    listener(value);
  });
  skip = false;
  return toDisposable(unsubscribe);
};

/** Change event of an observable (no immediate call). */
export const changes =
  <T>(observable: Observable<T>): Event<T> =>
  (listener, disposables) => {
    const subscription = observe(observable, listener, { immediate: false });
    disposables?.add(subscription);
    return subscription;
  };

export type Equality<T> = (a: T, b: T) => boolean;

/** An observable that never changes. */
export const constant = <T>(value: T): Observable<T> => ({
  get: () => value,
  subscribe: (run) => {
    run(value);
    return () => undefined;
  },
});

/**
 * Computes a value from other observables. Upstream subscriptions are held only while the
 * derived observable itself has subscribers; otherwise `get` computes on demand.
 */
export const derived = <const S extends readonly Observable<unknown>[], T>(
  sources: S,
  compute: (...values: ObservableValues<S>) => T,
  equals: Equality<T> = Object.is,
): Observable<T> => {
  const read = () => compute(...(sources.map((source) => source.get()) as ObservableValues<S>));
  let cache: ObservableValue<T> | undefined;
  let upstream: (() => void)[] = [];
  let listeners = 0;

  const start = () => {
    cache = new ObservableValue(read(), equals);
    let ready = false;
    upstream = sources.map((source) =>
      source.subscribe(() => {
        if (ready) cache!.set(read());
      }),
    );
    ready = true;
  };
  const stop = () => {
    for (const unsubscribe of upstream) unsubscribe();
    upstream = [];
    cache = undefined;
  };

  return {
    get: () => (cache ? cache.get() : read()),
    subscribe(run) {
      if (listeners++ === 0) start();
      const unsubscribe = cache!.subscribe(run);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        unsubscribe();
        if (--listeners === 0) stop();
      };
    },
  };
};

/**
 * Follows the observable currently held by `outer` (e.g. "apps of the current project"):
 * re-subscribes when `outer` changes and yields `fallback` while it holds nothing.
 */
export const switchObservable = <T>(
  outer: Observable<Observable<T> | undefined>,
  fallback: T,
): Observable<T> => ({
  get: () => outer.get()?.get() ?? fallback,
  subscribe(run) {
    let inner: (() => void) | undefined;
    const unsubscribeOuter = outer.subscribe((current) => {
      inner?.();
      inner = undefined;
      if (current) inner = current.subscribe(run);
      else run(fallback);
    });
    return () => {
      inner?.();
      unsubscribeOuter();
    };
  },
});
