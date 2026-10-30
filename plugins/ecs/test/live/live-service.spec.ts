import { describe, expect, it, vi } from 'vitest';

import {
  DocumentServiceToken,
  Emitter,
  ObservableValue,
  RuntimeServiceToken,
} from '@nanoforge-dev/editor-sdk';

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

describe('LiveService worlds', () => {
  const setup = () => {
    const app = { id: 'client', entryFile: 'apps/client/src/main.ts' };
    const fsChanges = new Emitter<readonly { path: string }[]>();
    const documentChanges = new Emitter<{ uri: string }>();
    const project = {
      model: new ObservableValue({ apps: [app] }),
      fs: { onDidChange: fsChanges.event },
    };
    const events = new Emitter<{ event: string; source: string; app: string; args: unknown[] }>();
    const session = new ObservableValue({ state: 'idle' });
    const runtime = {
      session,
      onEvent: events.event,
      useFeatures: () => ({ dispose: () => undefined }),
    };
    const services = new Map<unknown, unknown>([
      [RuntimeServiceToken, runtime],
      [DocumentServiceToken, { onDidChange: documentChanges.event }],
    ]);
    const context = {
      services: {
        tryGet: (token: unknown) => services.get(token),
        get: () => ({ current: new ObservableValue(project) }),
      },
    };
    /** Analyses resolve when the test says, to send a newer world first. */
    const analyses: { path: string; resolve: (model: unknown) => void }[] = [];
    const ecs = {
      analyzeLocation: (location: { path: string }) =>
        new Promise((resolve) => analyses.push({ path: location.path, resolve })),
      sceneLocation: () => undefined,
    };
    const service = new LiveService(context as never, ecs as never);
    session.set({ state: 'running' });
    const world = (id: number) => ({
      event: 'ecs-world',
      source: 'client',
      app: 'client',
      args: [{ systems: [], entities: [{ id, components: [] }] }],
    });
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    return { service, events, world, analyses, documentChanges, fsChanges, settle };
  };

  it('analyzes the entry file once per session, again after it changes', async () => {
    const { service, events, world, analyses, documentChanges, settle } = setup();
    events.fire(world(1));
    events.fire(world(2));
    expect(analyses).toHaveLength(1);
    analyses[0]!.resolve({ entities: [] });
    await settle();
    events.fire(world(3));
    await settle();
    expect(analyses).toHaveLength(1);
    expect(service.instance('client')!.entities.map((entity) => entity.id)).toEqual([3]);

    documentChanges.fire({ uri: 'apps/client/src/main.ts' });
    events.fire(world(4));
    expect(analyses).toHaveLength(2);
    service.dispose();
  });

  it('asks again when an analysis gave no model', async () => {
    const { service, events, world, analyses, settle } = setup();
    events.fire(world(1));
    analyses[0]!.resolve(undefined);
    await settle();
    events.fire(world(2));
    expect(analyses).toHaveLength(2);
    analyses[1]!.resolve({ entities: [] });
    await settle();
    events.fire(world(3));
    expect(analyses).toHaveLength(2);
    service.dispose();
  });

  it('never shows a world over a newer one', async () => {
    const { service, events, world, analyses, fsChanges, settle } = setup();
    events.fire(world(1));
    fsChanges.fire([{ path: 'apps/client/src/main.ts' }]);
    events.fire(world(2));
    expect(analyses).toHaveLength(2);
    analyses[1]!.resolve({ entities: [] });
    await settle();
    analyses[0]!.resolve({ entities: [] });
    await settle();
    expect(service.instance('client')!.entities.map((entity) => entity.id)).toEqual([2]);
    service.dispose();
  });
});
