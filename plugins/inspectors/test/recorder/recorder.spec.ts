import { describe, expect, it } from 'vitest';

import type { EngineFeatures, GameEvent } from '@nanoforge-dev/editor-sdk';

import {
  FEATURES,
  LIMITS,
  Recorder,
  isSpike,
  libraryRows,
  throughput,
} from '../../src/recorder/recorder';

const frame = (avg: number, max = avg) => ({
  windowMs: 250,
  ticks: 15,
  tps: 60,
  tick: { avg, max },
  libraries: { ecs: { avg: avg / 2, max }, graphics: { avg: avg / 4, max: avg } },
});
const event = (source: 'client' | 'server', name: string, payload: unknown): GameEvent => ({
  source,
  app: `apps/${source}`,
  event: name,
  args: [payload],
});
const totals = (packets: number, bytes: number) => ({ packets, bytes });

const fakeRuntime = () => {
  const requests = new Set<EngineFeatures>();
  let listener: ((event: GameEvent) => void) | undefined;
  return {
    requests,
    emit: (value: GameEvent) => listener?.(value),
    runtime: {
      onEvent: (next: (event: GameEvent) => void) => {
        listener = next;
        return { dispose: () => (listener = undefined) };
      },
      useFeatures: (features: EngineFeatures) => {
        requests.add(features);
        return { dispose: () => void requests.delete(features) };
      },
    },
  };
};

describe('Recorder', () => {
  it('keeps frame windows per game, with the system timings of the window', () => {
    let now = 1000;
    const recorder = new Recorder(() => now);
    recorder.acquire('profiler');
    const systems = {
      windowMs: 250,
      systems: [{ index: 0, name: 'move', calls: 15, avg: 1, max: 2 }],
    };
    recorder.handle(event('client', 'ecs-system-stats', systems));
    recorder.handle(event('client', 'frame-stats', frame(4)));
    now = 1250;
    recorder.handle(event('client', 'frame-stats', frame(5)));
    recorder.handle(event('server', 'frame-stats', frame(1)));
    expect(recorder.sources).toEqual(['client', 'server']);
    expect(recorder.record('client')!.frames).toEqual([
      { time: 1000, stats: frame(4), systems },
      { time: 1250, stats: frame(5), systems },
    ]);
    expect(recorder.record('server')!.frames[0]!.systems).toBeUndefined();
  });

  it('keeps the last windows and packets only', () => {
    const recorder = new Recorder();
    recorder.handle(event('client', 'frame-stats', frame(99)));
    expect(recorder.record('client')).toBeUndefined();
    const shown = recorder.acquire('profiler');
    for (let index = 0; index < LIMITS.frames + 5; index++)
      recorder.handle(event('client', 'frame-stats', frame(index)));
    const frames = recorder.record('client')!.frames;
    expect(frames).toHaveLength(LIMITS.frames);
    expect(frames[0]!.stats.tick.avg).toBe(5);
    shown.dispose();
    recorder.handle(event('client', 'frame-stats', frame(99)));
    expect(recorder.record('client')!.frames).toHaveLength(LIMITS.frames);
  });

  it('records packets, totals and what the engine left out, and the world', () => {
    const recorder = new Recorder();
    let revisions = 0;
    recorder.revision.subscribe(() => revisions++);
    const packet = { direction: 'in', transport: 'tcp', size: 3, head: '010203', time: 5 };
    recorder.handle(event('server', 'network-trace', packet));
    recorder.handle(event('server', 'network-trace', packet));
    const stats = {
      windowMs: 1000,
      time: 9,
      tcp: { in: totals(10, 300), out: totals(0, 0) },
      udp: { in: totals(5, 200), out: totals(20, 1000) },
      untraced: 13,
    };
    recorder.handle(event('server', 'network-stats', stats));
    recorder.handle(event('server', 'network-stats', stats));
    recorder.handle(event('server', 'ecs-world', { entities: [], systems: [] }));
    recorder.handle(event('server', 'state', 'running'));
    const record = recorder.record('server')!;
    expect(record.packets.map((entry) => entry.id)).toEqual([0, 1]);
    expect(record.untraced).toBe(26);
    expect(record.world).toEqual({ entities: [], systems: [] });
    expect(throughput(stats)).toEqual({
      in: { bytes: 500, packets: 15 },
      out: { bytes: 1000, packets: 20 },
    });
    expect(revisions).toBe(6);
    recorder.reset();
    expect(recorder.sources).toEqual([]);
  });

  it('starts from the world a paused game already sent', () => {
    const { runtime } = fakeRuntime();
    const world = { entities: [{ id: 1, components: [] }], systems: [] };
    const recorder = new Recorder();
    recorder.setRuntime({ ...runtime, lastWorlds: () => [event('server', 'ecs-world', world)] });
    expect(recorder.sources).toEqual(['server']);
    expect(recorder.record('server')!.world).toEqual(world);
  });

  it('asks the engine for an inspector only while something shows it', () => {
    const { runtime, requests, emit } = fakeRuntime();
    const recorder = new Recorder();
    const first = recorder.acquire('profiler');
    expect(requests.size).toBe(0);
    recorder.setRuntime(runtime);
    expect([...requests]).toEqual([FEATURES.profiler]);
    const second = recorder.acquire('profiler');
    const network = recorder.acquire('network');
    expect(requests.size).toBe(2);
    first.dispose();
    first.dispose();
    expect(requests.size).toBe(2);
    second.dispose();
    expect([...requests]).toEqual([FEATURES.network]);
    emit(
      event('client', 'network-trace', {
        direction: 'in',
        transport: 'tcp',
        size: 1,
        head: '01',
        time: 1,
      }),
    );
    expect(recorder.record('client')!.packets).toHaveLength(1);
    const other = fakeRuntime();
    recorder.setRuntime(other.runtime);
    expect(requests.size).toBe(0);
    expect([...other.requests]).toEqual([FEATURES.network]);
    network.dispose();
    expect(other.requests.size).toBe(0);
  });
});

describe('profiler numbers', () => {
  it('marks windows over the budget and ranks libraries', () => {
    const sample = { time: 0, stats: frame(8, 20) };
    expect(isSpike(sample, 16.7)).toBe(true);
    expect(isSpike(sample, 25)).toBe(false);
    expect(libraryRows(sample.stats)).toEqual([
      { name: 'ecs', avg: 4, max: 20, share: 0.5 },
      { name: 'graphics', avg: 2, max: 8, share: 0.25 },
    ]);
    expect(libraryRows(frame(0))[0]!.share).toBe(0);
  });
});
