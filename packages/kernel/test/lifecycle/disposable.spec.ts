import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type Disposable,
  DisposableStore,
  combineDisposables,
  disposeAll,
  setDisposableTracker,
  toDisposable,
} from '../../src/lifecycle/disposable';
import { MutableDisposable } from '../../src/lifecycle/mutable-disposable';

describe('toDisposable', () => {
  it('runs the cleanup once', () => {
    const fn = vi.fn();
    const d = toDisposable(fn);
    d.dispose();
    d.dispose();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('supports `using`', () => {
    const fn = vi.fn();
    {
      using d = toDisposable(fn) as Disposable & { [Symbol.dispose](): void };
      expect(d).toBeDefined();
      expect(fn).not.toHaveBeenCalled();
    }
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('DisposableStore', () => {
  it('disposes in reverse order', () => {
    const order: number[] = [];
    const store = new DisposableStore();
    store.add(toDisposable(() => order.push(1)));
    store.add(toDisposable(() => order.push(2)));
    store.dispose();
    expect(order).toEqual([2, 1]);
    expect(store.isDisposed).toBe(true);
  });

  it('disposes items added after disposal immediately', () => {
    const store = new DisposableStore();
    store.dispose();
    const fn = vi.fn();
    store.add(toDisposable(fn));
    expect(fn).toHaveBeenCalledOnce();
  });

  it('clear keeps the store usable', () => {
    const store = new DisposableStore();
    const a = vi.fn();
    store.add(toDisposable(a));
    store.clear();
    expect(a).toHaveBeenCalledOnce();
    const b = vi.fn();
    store.add(toDisposable(b));
    expect(b).not.toHaveBeenCalled();
    expect(store.size).toBe(1);
  });

  it('disposes everything even if one throws', () => {
    const fn = vi.fn();
    const store = new DisposableStore();
    store.add(toDisposable(fn));
    store.add(
      toDisposable(() => {
        throw new Error('boom');
      }),
    );
    expect(() => store.dispose()).toThrow('boom');
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('disposeAll', () => {
  it('aggregates multiple errors', () => {
    const fail = () =>
      toDisposable(() => {
        throw new Error('x');
      });
    expect(() => disposeAll([fail(), fail()])).toThrow(AggregateError);
  });
});

describe('MutableDisposable', () => {
  it('disposes the previous value on replace and on dispose', () => {
    const a = vi.fn();
    const b = vi.fn();
    const holder = new MutableDisposable();
    holder.value = toDisposable(a);
    holder.value = toDisposable(b);
    expect(a).toHaveBeenCalledOnce();
    holder.dispose();
    expect(b).toHaveBeenCalledOnce();
    const c = vi.fn();
    holder.value = toDisposable(c);
    expect(c).toHaveBeenCalledOnce();
  });
});

describe('tracker', () => {
  afterEach(() => setDisposableTracker(null));

  it('reports undisposed disposables', () => {
    const live = new Set<Disposable>();
    setDisposableTracker({ onCreate: (d) => live.add(d), onDispose: (d) => live.delete(d) });
    const d = combineDisposables(toDisposable(() => undefined));
    expect(live.size).toBe(2);
    d.dispose();
    expect(live.size).toBe(0);
  });
});
