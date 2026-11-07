import { describe, expect, it } from 'vitest';

import { mergeFeatures } from '../../src/compatibility/merge-features';

describe('mergeFeatures', () => {
  it('keeps the most demanding request of each feature', () => {
    expect(
      mergeFeatures([
        { frameStats: { intervalMs: 1000 } },
        { frameStats: { intervalMs: 250 }, networkTrace: { sampleRate: 0.1 } },
        { logs: true, networkTrace: { maxPerSecond: 500 } },
      ]),
    ).toEqual({
      frameStats: { intervalMs: 250 },
      logs: true,
      networkTrace: { sampleRate: 1, maxPerSecond: 500 },
    });
    expect(
      mergeFeatures([{ ecsWorld: { intervalMs: 200 } }, { ecsWorld: { intervalMs: 100 } }]),
    ).toEqual({
      ecsWorld: { intervalMs: 100 },
    });
    expect(
      mergeFeatures([
        { ecsSystemStats: { intervalMs: 500 }, networkTrace: { maxBytes: 64 } },
        { ecsSystemStats: { intervalMs: 250 }, networkTrace: { maxBytes: 512 } },
        { networkTrace: {} },
      ]),
    ).toEqual({
      ecsSystemStats: { intervalMs: 250 },
      networkTrace: { sampleRate: 1, maxPerSecond: 100, maxBytes: 512 },
    });
    expect(mergeFeatures([{}, { viewport: true }])).toEqual({ viewport: true });
    expect(
      mergeFeatures([{ scenes: { intervalMs: 250 } }, { scenes: { intervalMs: 100 } }]),
    ).toEqual({ scenes: { intervalMs: 100 } });
    expect(mergeFeatures([])).toEqual({});
  });
});
