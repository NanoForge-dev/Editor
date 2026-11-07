import type { Layout } from '../model/layout.type';
import type { SlotId } from '../model/slot-id.enum';
import type { LayoutOp } from './layout-op.type';
import { LayoutError } from './layout.exception';

/** Moves every tab of a floating window into a slot (one undoable step). */
export const dockFloatOp = (layout: Layout, floatId: string, slot: SlotId): LayoutOp => {
  const float = layout.floats.find((candidate) => candidate.id === floatId);
  if (!float) throw new LayoutError(`Floating window ${floatId} does not exist`);
  const start = layout.slots[slot].stack.tabs.length;
  return {
    type: 'batch',
    ops: float.stack.tabs.map((tab, index) => ({
      type: 'move' as const,
      instanceId: tab.instanceId,
      location: { kind: 'slot' as const, slot, index: start + index },
      activate: tab.instanceId === float.stack.active,
    })),
  };
};

/**
 * Shows or hides a slot on the active screen: changes the screen's override when it has one
 * for that slot, the slot otherwise.
 */
export const showSlotOp = (layout: Layout, slot: SlotId, visible: boolean): LayoutOp => {
  const screen = layout.activeScreen;
  return screen && layout.screenOverrides[screen]?.[slot] !== undefined
    ? { type: 'setScreenOverride', screen, slot, visible }
    : { type: 'toggleSlot', slot, visible };
};
