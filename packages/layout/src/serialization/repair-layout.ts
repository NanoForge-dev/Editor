import { z } from 'zod';

import { emptyLayout } from '../model/empty-layout';
import { LAYOUT_VERSION, MIN_FLOAT, MIN_SLOT_SIZE } from '../model/layout.const';
import type { Layout, TabStack } from '../model/layout.type';
import { SLOT_IDS, type SlotId } from '../model/slot-id.enum';
import { Float, Slot } from './layout.schema';

export const repairLayout = (raw: Record<string, unknown>): Layout => {
  const base = emptyLayout();
  const seen = new Set<string>();
  const cleanStack = (stack: TabStack): TabStack => {
    const tabs = stack.tabs.filter((tab) => {
      if (seen.has(tab.instanceId)) return false;
      seen.add(tab.instanceId);
      return true;
    });
    const active = tabs.some((tab) => tab.instanceId === stack.active)
      ? stack.active
      : (tabs[0]?.instanceId ?? null);
    return { tabs, active };
  };

  const rawSlots = (raw.slots ?? {}) as Record<string, unknown>;
  const slots = Object.fromEntries(
    SLOT_IDS.map((id) => {
      const parsed = Slot.safeParse(rawSlots[id]);
      const slot = parsed.success ? parsed.data : base.slots[id];
      return [
        id,
        {
          visible: slot.visible,
          size: Math.max(MIN_SLOT_SIZE, Math.round(slot.size)),
          stack: cleanStack(slot.stack),
        },
      ];
    }),
  ) as Record<SlotId, Layout['slots'][SlotId]>;

  const floats = z
    .array(z.unknown())
    .catch([])
    .parse(raw.floats)
    .flatMap((candidate) => {
      const parsed = Float.safeParse(candidate);
      if (!parsed.success) return [];
      const stack = cleanStack(parsed.data.stack);
      if (!stack.tabs.length) return [];
      return [
        {
          ...parsed.data,
          width: Math.max(MIN_FLOAT.width, parsed.data.width),
          height: Math.max(MIN_FLOAT.height, parsed.data.height),
          stack,
        },
      ];
    });

  const screens = z.array(z.string()).catch([]).parse(raw.screens);
  const activeScreen = z.string().nullable().catch(null).parse(raw.activeScreen);
  const maximized = z.string().nullable().catch(null).parse(raw.maximized);
  const split = z
    .object({
      left: z.number().catch(base.split.left),
      right: z.number().catch(base.split.right),
      bottom: z.number().catch(base.split.bottom),
    })
    .catch(base.split)
    .parse(raw.split);
  const overrides = z
    .record(z.string(), z.record(z.string(), z.boolean()))
    .catch({})
    .parse(raw.screenOverrides);

  return {
    version: LAYOUT_VERSION,
    screens: [...new Set(screens)],
    activeScreen:
      activeScreen && screens.includes(activeScreen) ? activeScreen : (screens[0] ?? null),
    slots,
    split: {
      left: Math.min(0.85, Math.max(0.15, split.left)),
      right: Math.min(0.85, Math.max(0.15, split.right)),
      bottom: Math.min(0.85, Math.max(0.15, split.bottom)),
    },
    floats,
    maximized: maximized && seen.has(maximized) ? maximized : null,
    screenOverrides: Object.fromEntries(
      Object.entries(overrides).map(([screen, values]) => [
        screen,
        Object.fromEntries(
          Object.entries(values).filter(([slot]) => (SLOT_IDS as readonly string[]).includes(slot)),
        ),
      ]),
    ),
  };
};
