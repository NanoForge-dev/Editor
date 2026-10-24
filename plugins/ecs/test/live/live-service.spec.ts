import { describe, expect, it, vi } from 'vitest';

import { ObservableValue } from '@nanoforge-dev/editor-sdk';

import { LiveService, type Pending, withoutApplied } from '../../src/live/live-service';

vi.mock('@nanoforge-dev/editor-sdk/ui', () => ({
  NotificationServiceToken: Symbol('notifications'),
}));

const pendingOf = (fields: Record<string, Record<string, unknown>>): Pending =>
  new Map([['client', new Map([['ball', new Map(Object.entries(fields))]])]]);

describe('withoutApplied', () => {
  it('drops the written components, unless they changed again', () => {
    const position = { x: 1 };
    const velocity = { dx: 2 };
    const pending = pendingOf({ Position: position, Velocity: velocity });
    const next = withoutApplied(pending, 'client', 'ball', new Map([['Position', position]]));
    expect([...next.get('client')!.get('ball')!.keys()]).toEqual(['Velocity']);
    expect(pending.get('client')!.get('ball')!.size).toBe(2);

    const stale = withoutApplied(pending, 'client', 'ball', new Map([['Position', { x: 1 }]]));
    expect(stale.get('client')!.get('ball')!.size).toBe(2);

    const all = withoutApplied(
      pending,
      'client',
      'ball',
      new Map([
        ['Position', position],
        ['Velocity', velocity],
      ]),
    );
    expect(all.get('client')!.has('ball')).toBe(false);
  });
});

describe('LiveService.applyToCode', () => {
  const setup = (results: boolean[]) => {
    const app = { id: 'client', entryFile: 'apps/client/src/main.ts' };
    const project = { model: new ObservableValue({ apps: [app] }) };
    const context = {
      services: {
        tryGet: () => undefined,
        get: () => ({ current: new ObservableValue(project) }),
      },
    };
    const calls: string[] = [];
    let running = 0;
    const ecs = {
      analyzeApp: async () => ({
        entities: [
          {
            name: 'ball',
            components: [
              { item: 'position', className: 'Position' },
              { item: 'velocity', className: 'Velocity' },
            ],
          },
        ],
      }),
      item: (id: string) => ({
        meta: { params: id === 'position' ? [{ name: 'x' }] : [{ name: 'dx' }] },
      }),
      applyTo: async (_app: unknown, _op: unknown, label: string) => {
        running++;
        if (running > 1) throw new Error('two writes at once');
        calls.push(label);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running--;
        return results.shift() ?? true;
      },
    };
    const service = new LiveService(context as never, ecs as never);
    const pending = (service as unknown as { _pending: ObservableValue<Pending> })._pending;
    return { service, pending, calls };
  };

  it('keeps a change pending when writing it failed', async () => {
    const { service, pending } = setup([false, true]);
    pending.set(pendingOf({ Position: { x: 1 }, Velocity: { dx: 2 } }));
    expect(await service.applyToCode('client', 'ball')).toBe(false);
    expect([...pending.get().get('client')!.get('ball')!.keys()]).toEqual(['Position']);
    expect(service.hasPending('client', 'ball')).toBe(true);
  });

  it('runs one apply at a time', async () => {
    const { service, pending, calls } = setup([]);
    pending.set(pendingOf({ Position: { x: 1 }, Velocity: { dx: 2 } }));
    const results = await Promise.all([
      service.applyToCode('client', 'ball'),
      service.applyToCode('client', 'ball'),
    ]);
    expect(results).toEqual([true, true]);
    expect(calls).toEqual(['Apply live Position of ball', 'Apply live Velocity of ball']);
    expect(service.hasPending('client', 'ball')).toBe(false);
  });
});
