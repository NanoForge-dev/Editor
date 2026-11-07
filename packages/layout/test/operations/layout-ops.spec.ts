import { describe, expect, it } from 'vitest';

import { isSlotVisible, showSlotOp } from '../../src';
import { apply, base } from '../fixtures/layout';

describe('showing slots', () => {
  it('changes the slot, or the screen override when there is one', () => {
    const hidden = apply(base(), showSlotOp(base(), 'leftTop', false));
    expect(isSlotVisible(hidden, 'leftTop')).toBe(false);
    expect(hidden.slots.leftTop.visible).toBe(false);

    const overridden = apply(base(), {
      type: 'setScreenOverride',
      screen: 'scene',
      slot: 'bottom',
      visible: false,
    });
    const shown = apply(overridden, showSlotOp(overridden, 'bottom', true));
    expect(isSlotVisible(shown, 'bottom')).toBe(true);
    expect(shown.screenOverrides.scene).toEqual({ bottom: true });
  });
});
