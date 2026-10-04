import { describe, expect, it, vi } from 'vitest';

import { type HistoryCommand, HistoryService } from '../../src';
import { cell, setup } from '../fixtures/history';

describe('history panel support', () => {
  it('jumps to any step, backward and forward', async () => {
    const { context, history } = setup();
    const { state, set } = cell(0);
    for (const value of [1, 2, 3, 4]) await context.stack.push(set(value));
    const ids = context.stack.state.past.map((entry) => entry.id);

    await history.goTo('scene', ids[1]!);
    expect(state.value).toBe(2);
    expect(context.stack.state.future).toHaveLength(2);

    await history.goTo('scene', ids[3]!);
    expect(state.value).toBe(4);
    await history.goTo('scene', 0);
    expect(state.value).toBe(0);

    await history.clear('scene');
    expect(context.stack.state.past).toHaveLength(0);
    expect(context.stack.state.future).toHaveLength(0);
  });

  it('exposes the steps of transactions', async () => {
    const { context } = setup();
    const { set } = cell(0);
    await context.stack.transaction('Drag', async (tx) => {
      await tx.push(set(1));
      await tx.push(set(2));
    });
    expect(context.stack.state.past[0]!.command.children?.map((child) => child.label)).toEqual([
      'set 1',
      'set 2',
    ]);
  });

  it('keeps serializable histories of matching contexts across reloads', async () => {
    const saved = new Map<string, unknown>();
    const store = {
      load: async (id: string) => saved.get(id) as never,
      save: async (id: string, entries: unknown) => void saved.set(id, entries),
    };
    const values = { current: 0 };
    const command = (value: number, previous: number): HistoryCommand => ({
      label: `set ${value}`,
      do: () => void (values.current = value),
      undo: () => void (values.current = previous),
      serialize: () => ({ type: 'set', label: `set ${value}`, data: { value, previous } }),
    });

    const first = new HistoryService();
    first.persist((id) => id.startsWith('file:'), store);
    const context = first.registerContext({ id: 'file:a.ts', label: 'a.ts' });
    await context.stack.push(command(1, 0));
    await context.stack.push(command(2, 1));
    await vi.waitFor(() => expect(saved.get('file:a.ts')).toHaveLength(2));
    first.dispose();

    const second = new HistoryService();
    second.registerDeserializer('set', (data) => {
      const { value, previous } = data as { value: number; previous: number };
      return command(value, previous);
    });
    second.persist((id) => id.startsWith('file:'), store);
    const restored = second.registerContext({ id: 'file:a.ts', label: 'a.ts' });
    await vi.waitFor(() => expect(restored.stack.state.past).toHaveLength(2));
    await restored.stack.undo();
    expect(values.current).toBe(1);
    const other = second.registerContext({ id: 'layout', label: 'Layout' });
    await other.stack.push(command(9, 0));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(saved.has('layout')).toBe(false);
  });
});
