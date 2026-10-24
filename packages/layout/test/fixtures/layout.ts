import { type Layout, type LayoutOp, composeDefaultLayout, reduce } from '../../src';

export const widgets = [
  { id: 'scene', kind: 'screen' as const, order: 0 },
  { id: 'script', kind: 'screen' as const, order: 1 },
  { id: 'game', kind: 'screen' as const, order: 2 },
  { id: 'files', kind: 'dock' as const, defaultSlot: 'leftTop' as const },
  { id: 'hierarchy', kind: 'dock' as const, defaultSlot: 'leftTop' as const, order: -1 },
  { id: 'inspector', kind: 'dock' as const, defaultSlot: 'rightTop' as const },
  { id: 'console', kind: 'dock' as const, defaultSlot: 'bottom' as const },
  { id: 'profiler', kind: 'dock' as const, defaultSlot: 'bottom' as const, openByDefault: false },
];

export const base = () => composeDefaultLayout(widgets);
export const apply = (layout: Layout, ...ops: LayoutOp[]) =>
  ops.reduce((current, op) => reduce(current, op).layout, layout);
