import { describe, expect, it } from 'vitest';

import { type Layout, type LayoutOp, SLOT_IDS, allWidgets, reduce } from '../../src';
import { base } from '../fixtures/layout';

/** Deterministic pseudo random generator (mulberry32). */
const random = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const randomOp = (layout: Layout, next: () => number, counter: { n: number }): LayoutOp => {
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!;
  const instances = allWidgets(layout).map((ref) => ref.instanceId);
  const location = () =>
    next() < 0.3
      ? layout.floats.length && next() < 0.5
        ? { kind: 'float' as const, floatId: pick(layout.floats).id, index: Math.floor(next() * 3) }
        : {
            kind: 'float' as const,
            floatId: `f${counter.n++}`,
            index: 0,
            rect: {
              x: next() * 800,
              y: next() * 600,
              width: 150 + next() * 400,
              height: 100 + next() * 300,
            },
          }
      : { kind: 'slot' as const, slot: pick(SLOT_IDS), index: Math.floor(next() * 4) };
  const kinds = [
    'add',
    'remove',
    'move',
    'activate',
    'resizeSlot',
    'toggleSlot',
    'switchScreen',
    'maximize',
    'setSplit',
    'batch',
  ];
  switch (pick(kinds)) {
    case 'add':
      return {
        type: 'add',
        ref: { instanceId: `w${counter.n++}`, widgetId: 'dummy' },
        location: location(),
        activate: next() < 0.5,
      };
    case 'remove':
      return instances.length
        ? { type: 'remove', instanceId: pick(instances) }
        : { type: 'batch', ops: [] };
    case 'move':
      return instances.length
        ? {
            type: 'move',
            instanceId: pick(instances),
            location: location(),
            activate: next() < 0.5,
          }
        : { type: 'batch', ops: [] };
    case 'activate':
      return instances.length
        ? { type: 'activate', instanceId: pick(instances) }
        : { type: 'batch', ops: [] };
    case 'resizeSlot':
      return { type: 'resizeSlot', slot: pick(SLOT_IDS), size: 50 + next() * 500 };
    case 'toggleSlot':
      return { type: 'toggleSlot', slot: pick(SLOT_IDS), visible: next() < 0.5 };
    case 'switchScreen':
      return { type: 'switchScreen', screen: pick(layout.screens) };
    case 'maximize':
      return {
        type: 'maximize',
        instanceId: instances.length && next() < 0.7 ? pick(instances) : null,
      };
    case 'setSplit':
      return { type: 'setSplit', side: next() < 0.5 ? 'left' : 'right', ratio: next() };
    default: {
      const first = randomOp(layout, next, counter);
      return { type: 'batch', ops: [first] };
    }
  }
};

describe('inverse operations', () => {
  it('restore the exact previous layout (1000 random sequences)', () => {
    const next = random(42);
    const counter = { n: 0 };
    for (let run = 0; run < 1000; run++) {
      let layout = base();
      const history: { before: Layout; inverse: LayoutOp }[] = [];
      for (let step = 0; step < 8; step++) {
        const op = randomOp(layout, next, counter);
        const { layout: after, inverse } = reduce(layout, op);
        history.push({ before: layout, inverse });
        layout = after;
      }
      for (const { before, inverse } of history.reverse()) {
        layout = reduce(layout, inverse).layout;
        const strip = (value: Layout) => ({
          ...value,
          floats: value.floats.map((float) => ({ ...float, z: 0 })),
        });
        expect(strip(layout)).toEqual(strip(before));
      }
    }
  });
});
