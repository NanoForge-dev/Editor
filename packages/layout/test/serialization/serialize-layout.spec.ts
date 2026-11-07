import { describe, expect, it } from 'vitest';

import { deserializeLayout, emptyLayout, findWidget, serializeLayout } from '../../src';
import { apply, base } from '../fixtures/layout';

describe('serialization', () => {
  it('round-trips and repairs broken documents', () => {
    const layout = apply(base(), {
      type: 'move',
      instanceId: 'console',
      location: {
        kind: 'float',
        floatId: 'f',
        index: 0,
        rect: { x: 1, y: 2, width: 300, height: 200 },
      },
    });
    expect(deserializeLayout(serializeLayout(layout))).toEqual(layout);

    const broken = JSON.parse(serializeLayout(layout));
    broken.slots.bottom.stack = {
      tabs: [{ instanceId: 'files', widgetId: 'files' }],
      active: 'ghost',
    };
    broken.slots.leftTop.size = -5;
    broken.maximized = 'ghost';
    broken.floats.push({
      id: 'empty',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      stack: { tabs: [], active: null },
    });
    const repaired = deserializeLayout(broken)!;
    expect(findWidget(repaired, 'files')!.location).toMatchObject({
      kind: 'slot',
      slot: 'leftTop',
    });
    expect(repaired.slots.bottom.stack).toEqual({ tabs: [], active: null });
    expect(repaired.slots.leftTop.size).toBe(120);
    expect(repaired.maximized).toBeNull();
    expect(repaired.floats.map((float) => float.id)).toEqual(['f']);
  });

  it('reads layouts saved before the bottom right slot', () => {
    const old = JSON.parse(serializeLayout(base()));
    delete old.slots.bottomRight;
    old.split = { left: 0.4, right: 0.6 };
    const layout = deserializeLayout(old)!;
    expect(layout.slots.bottomRight).toEqual(emptyLayout().slots.bottomRight);
    expect(layout.split).toEqual({ left: 0.4, right: 0.6, bottom: 0.5 });
  });

  it('rejects unusable documents', () => {
    expect(deserializeLayout('not json')).toBeUndefined();
    expect(deserializeLayout({ version: 99 })).toBeUndefined();
    expect(deserializeLayout(null)).toBeUndefined();
    expect(deserializeLayout({ version: 1 })).toEqual({ ...emptyLayout() });
  });
});
