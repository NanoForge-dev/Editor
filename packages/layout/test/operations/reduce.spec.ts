import { describe, expect, it } from 'vitest';

import { LayoutError, dockFloatOp, isSlotVisible, reduce } from '../../src';
import { apply, base } from '../fixtures/layout';

describe('operations', () => {
  it('floats a widget into a new window and docks it back', () => {
    const floated = apply(base(), {
      type: 'move',
      instanceId: 'inspector',
      location: {
        kind: 'float',
        floatId: 'f1',
        index: 0,
        rect: { x: 40, y: 50, width: 90, height: 300 },
      },
    });
    expect(floated.floats).toHaveLength(1);
    expect(floated.floats[0]).toMatchObject({
      id: 'f1',
      width: 200,
      height: 300,
      stack: { active: 'inspector' },
    });
    expect(floated.slots.rightTop.stack.tabs).toEqual([]);
    const docked = apply(floated, dockFloatOp(floated, 'f1', 'bottom'));
    expect(docked.floats).toEqual([]);
    expect(docked.slots.bottom.stack.tabs.map((tab) => tab.instanceId)).toEqual([
      'console',
      'inspector',
    ]);
  });

  it('reorders tabs inside a stack', () => {
    const layout = apply(base(), {
      type: 'move',
      instanceId: 'hierarchy',
      location: { kind: 'slot', slot: 'leftTop', index: 1 },
    });
    expect(layout.slots.leftTop.stack.tabs.map((tab) => tab.instanceId)).toEqual([
      'files',
      'hierarchy',
    ]);
  });

  it('keeps the neighbour active when the active tab closes', () => {
    const layout = apply(base(), { type: 'remove', instanceId: 'hierarchy' });
    expect(layout.slots.leftTop.stack.active).toBe('files');
  });

  it('applies screen overrides to slot visibility', () => {
    const layout = apply(
      base(),
      { type: 'setScreenOverride', screen: 'script', slot: 'rightTop', visible: false },
      { type: 'switchScreen', screen: 'script' },
    );
    expect(isSlotVisible(layout, 'rightTop')).toBe(false);
    expect(
      isSlotVisible(apply(layout, { type: 'switchScreen', screen: 'scene' }), 'rightTop'),
    ).toBe(true);
  });

  it('rejects operations that do not apply', () => {
    expect(() => reduce(base(), { type: 'remove', instanceId: 'nope' })).toThrow(LayoutError);
    expect(() => reduce(base(), { type: 'switchScreen', screen: 'nope' })).toThrow(LayoutError);
    expect(() =>
      reduce(base(), {
        type: 'add',
        ref: { instanceId: 'files', widgetId: 'files' },
        location: { kind: 'slot', slot: 'bottom', index: 0 },
      }),
    ).toThrow(/already/);
  });
});
