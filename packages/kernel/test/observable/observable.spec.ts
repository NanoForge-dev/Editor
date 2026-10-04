import { describe, expect, it, vi } from 'vitest';

import { Emitter } from '../../src/event/emitter';
import {
  changes,
  constant,
  derived,
  observe,
  switchObservable,
} from '../../src/observable/observable';
import { ObservableValue } from '../../src/observable/observable-value';

describe('ObservableValue', () => {
  it('follows the svelte store contract', () => {
    const value = new ObservableValue(1);
    const run = vi.fn();
    const unsubscribe = value.subscribe(run);
    value.set(2);
    value.set(2);
    unsubscribe();
    value.set(3);
    expect(run.mock.calls).toEqual([[1], [2]]);
  });

  it('observe can skip the immediate call', () => {
    const value = new ObservableValue('a');
    const fn = vi.fn();
    const sub = observe(value, fn, { immediate: false });
    value.update((v) => v + 'b');
    sub.dispose();
    value.set('c');
    expect(fn).toHaveBeenCalledExactlyOnceWith('ab');
  });

  it('changes() exposes an event', () => {
    const value = new ObservableValue(0);
    const fn = vi.fn();
    changes(value)(fn);
    value.set(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(1);
  });
});

describe('derived', () => {
  it('computes on demand without subscribers', () => {
    const a = new ObservableValue(1);
    const double = derived([a], (x) => x * 2);
    expect(double.get()).toBe(2);
    a.set(5);
    expect(double.get()).toBe(10);
    expect(a.subscriberCount).toBe(0);
  });

  it('subscribes upstream only while observed', () => {
    const a = new ObservableValue(1);
    const b = new ObservableValue(2);
    const sum = derived([a, b, constant(10)], (x, y, z) => x + y + z);
    const run = vi.fn();
    const unsubscribe = sum.subscribe(run);
    a.set(3);
    b.set(2); // unchanged: no notification
    expect(run.mock.calls).toEqual([[13], [15]]);
    expect(a.subscriberCount).toBe(1);
    unsubscribe();
    unsubscribe();
    expect(a.subscriberCount).toBe(0);
  });

  it('does not notify when the derived value is equal', () => {
    const a = new ObservableValue(1);
    const parity = derived([a], (x) => x % 2);
    const run = vi.fn();
    parity.subscribe(run);
    a.set(3);
    expect(run).toHaveBeenCalledOnce();
  });

  it('works with emitters feeding values', () => {
    const emitter = new Emitter<number>();
    const value = new ObservableValue(0);
    emitter.event((n) => value.set(n));
    const run = vi.fn();
    derived([value], (n) => `#${n}`).subscribe(run);
    emitter.fire(4);
    expect(run).toHaveBeenLastCalledWith('#4');
  });
});

describe('switchObservable', () => {
  it('follows the current inner observable', async () => {
    const a = new ObservableValue(1);
    const b = new ObservableValue(10);
    const outer = new ObservableValue<ObservableValue<number> | undefined>(undefined);
    const run = vi.fn();
    const unsubscribe = switchObservable(outer, 0).subscribe(run);
    outer.set(a);
    a.set(2);
    outer.set(b);
    a.set(3); // no longer followed
    b.set(11);
    unsubscribe();
    b.set(12);
    expect(run.mock.calls.map(([v]) => v)).toEqual([0, 1, 2, 10, 11]);
    expect(a.subscriberCount + b.subscriberCount).toBe(0);
  });
});
