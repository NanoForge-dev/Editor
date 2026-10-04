import { describe, expect, it, vi } from 'vitest';

import type { HistoryCommand } from '../../src';
import { cell, setup } from '../fixtures/history';

describe('HistoryStack', () => {
  it('undoes and redoes, and a new change drops the redo steps', async () => {
    const { stack } = setup();
    const { state, set } = cell(0);
    await stack.push(set(1));
    await stack.push(set(2));
    await stack.undo();
    expect(state.value).toBe(1);
    await stack.redo();
    expect(state.value).toBe(2);
    await stack.undo();
    await stack.push(set(5));
    expect(stack.state.canRedo).toBe(false);
    await stack.undo();
    expect(state.value).toBe(1);
  });

  it('trims to the limit, live when the setting changes', async () => {
    const { stack, limit } = setup({ limit: 3 });
    const { state, set } = cell(0);
    const disposed = vi.fn();
    for (let i = 1; i <= 5; i++) await stack.push(set(i, { dispose: disposed }));
    expect(stack.state.past).toHaveLength(3);
    expect(disposed).toHaveBeenCalledTimes(2);
    limit.set(1);
    await stack.trim();
    expect(stack.state.past).toHaveLength(1);
    while (await stack.undo());
    expect(state.value).toBe(4);
  });

  it('trims to the memory budget', async () => {
    const { stack } = setup({ budgetBytes: 1000 });
    const { set } = cell(0);
    for (let i = 1; i <= 5; i++) await stack.push(set(i, { sizeBytes: 400 }));
    expect(stack.state.past.map((entry) => entry.command.label)).toEqual(['set 4', 'set 5']);
  });

  it('merges same-key changes within the merge window only', async () => {
    let now = 0;
    const { stack } = setup({ now: () => now });
    const { state, set } = cell(0);
    await stack.push(set(1, { mergeKey: 'x' }));
    now = 300;
    await stack.push(set(2, { mergeKey: 'x' }));
    now = 700;
    await stack.push(set(3, { mergeKey: 'x' }));
    now = 1500;
    await stack.push(set(4, { mergeKey: 'x' })); // too late: new step
    expect(stack.state.past).toHaveLength(2);
    await stack.undo();
    expect(state.value).toBe(3);
    await stack.undo();
    expect(state.value).toBe(0);
    await stack.redo();
    expect(state.value).toBe(3);
  });

  it('groups transactions and rolls back nested failures', async () => {
    const { stack } = setup();
    const a = cell(0);
    const b = cell(0);
    await stack.transaction('move', async (tx) => {
      await tx.push(a.set(1));
      await tx.transaction('inner', async (inner) => inner.push(b.set(1)));
    });
    expect(stack.state.past).toHaveLength(1);
    await expect(
      stack.transaction('broken', async (tx) => {
        await tx.push(a.set(2));
        await tx.transaction('inner', async (inner) => {
          await inner.push(b.set(2));
          throw new Error('boom');
        });
      }),
    ).rejects.toThrow('boom');
    expect([a.state.value, b.state.value]).toEqual([1, 1]);
    expect(stack.state.past).toHaveLength(1);
    await stack.undo();
    expect([a.state.value, b.state.value]).toEqual([0, 0]);
  });

  it('runs async operations in order', async () => {
    const { stack } = setup();
    const log: string[] = [];
    const slow = (name: string, ms: number): HistoryCommand => ({
      label: name,
      do: () =>
        new Promise<void>((resolve) => setTimeout(() => (log.push(`do ${name}`), resolve()), ms)),
      undo: () => void log.push(`undo ${name}`),
    });
    await Promise.all([
      stack.push(slow('a', 30)),
      stack.push(slow('b', 0)),
      stack.undo(),
      stack.redo(),
    ]);
    expect(log).toEqual(['do a', 'do b', 'undo b', 'do b']);
  });

  it('never undoes changes of other origins', async () => {
    const { stack } = setup();
    const mine = cell(0);
    const theirs = cell(0);
    await stack.push(mine.set(1));
    theirs.set(7).do();
    await stack.record({ ...theirs.set(7), origin: { kind: 'remote', id: 'bob' } });
    expect(stack.state.past.map((entry) => entry.undoable)).toEqual([true, false]);
    await stack.undo();
    expect([mine.state.value, theirs.state.value]).toEqual([0, 7]);
    expect(stack.state.canUndo).toBe(false);
  });

  it('tracks the savepoint for dirty state', async () => {
    const { stack } = setup();
    const { set } = cell(0);
    expect(stack.state.dirty).toBe(false);
    await stack.push(set(1));
    stack.markSaved();
    expect(stack.state.dirty).toBe(false);
    await stack.push(set(2));
    expect(stack.state.dirty).toBe(true);
    await stack.undo();
    expect(stack.state.dirty).toBe(false);
  });

  it('drops the history when a command is no longer valid', async () => {
    const { history, stack } = setup();
    const invalidated = vi.fn();
    history.onDidInvalidate(invalidated);
    const { state, set } = cell(0);
    await stack.push(set(1, { isValid: () => false }));
    expect(await stack.undo()).toBe(false);
    expect(state.value).toBe(1);
    expect(stack.state.past).toHaveLength(0);
    expect(invalidated).toHaveBeenCalledWith({ contextId: 'scene', reason: 'invalid-command' });
  });
});
