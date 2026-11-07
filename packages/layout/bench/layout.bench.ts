import { bench, describe } from 'vitest';

import {
  type Layout,
  type LayoutOp,
  SLOT_IDS,
  type WidgetPlacement,
  composeDefaultLayout,
  deserializeLayout,
  reduce,
  serializeLayout,
} from '../src';

/**
 * The layout model under a load well above a real editor's (about 20 widgets): 120 docks and
 * 8 screens. Every drag step, tab click and resize is one `reduce`, so these are the costs that
 * could make the workbench feel slow. Run with `pnpm --filter @nanoforge-dev/editor-layout bench`.
 */
const widgets: WidgetPlacement[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `screen.${i}`,
    kind: 'screen' as const,
    order: i,
  })),
  ...Array.from({ length: 120 }, (_, i) => ({
    id: `dock.${i}`,
    kind: 'dock' as const,
    defaultSlot: SLOT_IDS[i % SLOT_IDS.length]!,
    order: i,
  })),
];
const layout: Layout = composeDefaultLayout(widgets);
const serialized = serializeLayout(layout);
const apply = (start: Layout, ops: readonly LayoutOp[]) =>
  ops.reduce((current, op) => reduce(current, op).layout, start);

const resizes: LayoutOp[] = Array.from({ length: 200 }, (_, i) => ({
  type: 'resizeSlot',
  slot: 'leftTop',
  size: 200 + (i % 100),
}));
const activations: LayoutOp[] = Array.from({ length: 120 }, (_, i) => ({
  type: 'activate',
  instanceId: `dock.${i}`,
}));
const moves: LayoutOp[] = Array.from({ length: 120 }, (_, i) => ({
  type: 'move',
  instanceId: `dock.${i}`,
  location: { kind: 'slot', slot: SLOT_IDS[(i + 1) % SLOT_IDS.length]!, index: 0 },
}));

describe('layout model, 128 widgets', () => {
  bench('compose the default layout', () => {
    composeDefaultLayout(widgets);
  });
  bench('200 splitter resizes', () => {
    apply(layout, resizes);
  });
  bench('120 tab activations', () => {
    apply(layout, activations);
  });
  bench('120 moves between slots', () => {
    apply(layout, moves);
  });
  bench('serialize and read back', () => {
    deserializeLayout(JSON.parse(serializeLayout(layout)));
  });
  bench('read a saved layout', () => {
    deserializeLayout(JSON.parse(serialized));
  });
});
