import { afterEach, describe, expect, it, vi } from 'vitest';

import { Emitter, setListenerErrorHandler } from '../../src/event/emitter';
import { EventBus } from '../../src/event/event-bus';
import { Events } from '../../src/event/events';
import { type Disposable, DisposableStore } from '../../src/lifecycle/disposable';

describe('Emitter', () => {
  afterEach(() => setListenerErrorHandler(console.error));

  it('delivers to listeners until they unsubscribe', () => {
    const emitter = new Emitter<number>();
    const fn = vi.fn();
    const sub = emitter.event(fn);
    emitter.fire(1);
    sub.dispose();
    emitter.fire(2);
    expect(fn).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('isolates listener errors', () => {
    const onError = vi.fn();
    setListenerErrorHandler(onError);
    const emitter = new Emitter<void>();
    const fn = vi.fn();
    emitter.event(() => {
      throw new Error('boom');
    });
    emitter.event(fn);
    emitter.fire();
    expect(onError).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('calls first/last listener hooks', () => {
    const first = vi.fn();
    const last = vi.fn();
    const emitter = new Emitter<void>({ onFirstListenerAdd: first, onLastListenerRemove: last });
    const a = emitter.event(() => undefined);
    const b = emitter.event(() => undefined);
    a.dispose();
    expect(last).not.toHaveBeenCalled();
    b.dispose();
    expect(first).toHaveBeenCalledOnce();
    expect(last).toHaveBeenCalledOnce();
  });

  it('does not deliver to a listener removed during the same fire', () => {
    const emitter = new Emitter<void>();
    const late = vi.fn();
    let lateSub: Disposable = { dispose: () => undefined };
    emitter.event(() => lateSub.dispose());
    lateSub = emitter.event(late);
    emitter.fire();
    expect(late).not.toHaveBeenCalled();
  });

  it('registers subscriptions in a store', () => {
    const emitter = new Emitter<number>();
    const store = new DisposableStore();
    const fn = vi.fn();
    emitter.event(fn, store);
    store.dispose();
    emitter.fire(1);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('Events', () => {
  it('once, map and filter', () => {
    const emitter = new Emitter<number>();
    const once = vi.fn();
    const mapped = vi.fn();
    Events.once(emitter.event)(once);
    Events.map(
      Events.filter(emitter.event, (n) => n > 1),
      (n) => n * 10,
    )(mapped);
    emitter.fire(1);
    emitter.fire(2);
    expect(once).toHaveBeenCalledExactlyOnceWith(1);
    expect(mapped).toHaveBeenCalledExactlyOnceWith(20);
  });

  it('debounce merges bursts', () => {
    vi.useFakeTimers();
    const emitter = new Emitter<number>();
    const fn = vi.fn();
    Events.debounce<number, number[]>(emitter.event, (all = [], n) => [...all, n], 50)(fn);
    emitter.fire(1);
    emitter.fire(2);
    vi.advanceTimersByTime(49);
    emitter.fire(3);
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledExactlyOnceWith([1, 2, 3]);
    vi.useRealTimers();
  });

  it('toPromise resolves with the next value', async () => {
    const emitter = new Emitter<string>();
    const promise = Events.toPromise(emitter.event);
    emitter.fire('ok');
    await expect(promise).resolves.toBe('ok');
  });
});

describe('EventBus', () => {
  it('routes typed events by key', () => {
    const bus = new EventBus<{ 'test.ping': { n: number } }>();
    const fn = vi.fn();
    const sub = bus.on('test.ping', fn);
    bus.emit('test.ping', { n: 1 });
    sub.dispose();
    bus.emit('test.ping', { n: 2 });
    expect(fn).toHaveBeenCalledExactlyOnceWith({ n: 1 });
  });
});
