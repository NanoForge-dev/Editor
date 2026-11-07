import type { Layout, Location, WidgetRef } from './layout.type';
import { SLOT_IDS, type SlotId } from './slot-id.enum';

export const findWidget = (
  layout: Layout,
  instanceId: string,
): { location: Location; ref: WidgetRef; active: boolean } | undefined => {
  for (const slot of SLOT_IDS) {
    const stack = layout.slots[slot].stack;
    const index = stack.tabs.findIndex((tab) => tab.instanceId === instanceId);
    if (index >= 0) {
      return {
        location: { kind: 'slot', slot, index },
        ref: stack.tabs[index]!,
        active: stack.active === instanceId,
      };
    }
  }
  for (const float of layout.floats) {
    const index = float.stack.tabs.findIndex((tab) => tab.instanceId === instanceId);
    if (index >= 0) {
      const rect = { x: float.x, y: float.y, width: float.width, height: float.height };
      return {
        location: { kind: 'float', floatId: float.id, index, rect },
        ref: float.stack.tabs[index]!,
        active: float.stack.active === instanceId,
      };
    }
  }
  return undefined;
};

/** Every widget instance in the layout. */
export const allWidgets = (layout: Layout): WidgetRef[] => [
  ...SLOT_IDS.flatMap((slot) => layout.slots[slot].stack.tabs),
  ...layout.floats.flatMap((float) => float.stack.tabs),
];

/** Whether a slot is shown on the active screen (overrides applied). */
export const isSlotVisible = (layout: Layout, slot: SlotId): boolean => {
  const override = layout.activeScreen
    ? layout.screenOverrides[layout.activeScreen]?.[slot]
    : undefined;
  return override ?? layout.slots[slot].visible;
};
