import { type Disposable, DisposableStore, toDisposable } from '../lifecycle/disposable';
import type { Event } from './emitter';

/** Combinators over `Event`. Derived events subscribe upstream lazily. */
export const Events = {
  None: ((): Disposable => toDisposable(() => undefined)) as Event<never>,

  once<T>(event: Event<T>): Event<T> {
    return (listener, disposables) => {
      let fired = false;
      const subscription = event((value) => {
        if (fired) return;
        fired = true;
        subscription.dispose();
        listener(value);
      }, disposables);
      if (fired) subscription.dispose();
      return subscription;
    };
  },

  map<T, U>(event: Event<T>, fn: (value: T) => U): Event<U> {
    return (listener, disposables) => event((value) => listener(fn(value)), disposables);
  },

  filter<T>(event: Event<T>, predicate: (value: T) => boolean): Event<T> {
    return (listener, disposables) =>
      event((value) => {
        if (predicate(value)) listener(value);
      }, disposables);
  },

  any<T>(...events: Event<T>[]): Event<T> {
    return (listener, disposables) => {
      const store = new DisposableStore();
      for (const event of events) event(listener, store);
      disposables?.add(store);
      return store;
    };
  },

  /** Merges bursts of events: `merge` folds values until `delay` ms pass without a new one. */
  debounce<T, R>(
    event: Event<T>,
    merge: (last: R | undefined, value: T) => R,
    delay: number,
  ): Event<R> {
    return (listener, disposables) => {
      let pending: R | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const upstream = event((value) => {
        pending = merge(pending, value);
        clearTimeout(timer);
        timer = setTimeout(() => {
          const result = pending as R;
          pending = undefined;
          timer = undefined;
          listener(result);
        }, delay);
      });
      const subscription = toDisposable(() => {
        clearTimeout(timer);
        upstream.dispose();
      });
      disposables?.add(subscription);
      return subscription;
    };
  },

  toPromise<T>(event: Event<T>): Promise<T> {
    return new Promise((resolve) => {
      Events.once(event)(resolve);
    });
  },
};
