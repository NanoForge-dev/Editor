import { findWidget } from '../model/layout-queries';
import { MIN_FLOAT, MIN_SLOT_SIZE } from '../model/layout.const';
import type {
  FloatWindow,
  Layout,
  Location,
  Rect,
  TabStack,
  WidgetRef,
} from '../model/layout.type';
import type { SlotId } from '../model/slot-id.enum';
import type { LayoutOp, Reduction } from './layout-op.type';
import { LayoutError } from './layout.exception';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const insertTab = (stack: TabStack, ref: WidgetRef, index: number, activate: boolean): TabStack => {
  const tabs = [...stack.tabs];
  tabs.splice(clamp(index, 0, tabs.length), 0, ref);
  return { tabs, active: activate || !stack.active ? ref.instanceId : stack.active };
};

const removeTab = (stack: TabStack, instanceId: string): TabStack => {
  const index = stack.tabs.findIndex((tab) => tab.instanceId === instanceId);
  const tabs = stack.tabs.filter((tab) => tab.instanceId !== instanceId);
  const active =
    stack.active === instanceId
      ? (tabs[Math.min(index, tabs.length - 1)]?.instanceId ?? null)
      : stack.active;
  return { tabs, active };
};

const updateSlot = (
  layout: Layout,
  slot: SlotId,
  update: (stack: TabStack) => TabStack,
): Layout => ({
  ...layout,
  slots: {
    ...layout.slots,
    [slot]: { ...layout.slots[slot], stack: update(layout.slots[slot].stack) },
  },
});

/** Active tab of the stack a location points to (null for a float that does not exist yet). */
const activeAt = (layout: Layout, location: Location): string | null =>
  location.kind === 'slot'
    ? layout.slots[location.slot].stack.active
    : (layout.floats.find((float) => float.id === location.floatId)?.stack.active ?? null);

/** Inverse followed by re-activating the tabs that were active in the touched stacks. */
const withActivation = (
  inverse: LayoutOp,
  previousActives: readonly (string | null)[],
): LayoutOp => {
  const activations = [...new Set(previousActives)]
    .filter((id): id is string => id !== null)
    .map((instanceId): LayoutOp => ({ type: 'activate', instanceId }));
  return activations.length ? { type: 'batch', ops: [inverse, ...activations] } : inverse;
};

const nextZ = (layout: Layout) => Math.max(0, ...layout.floats.map((float) => float.z)) + 1;

/** Places a widget at a location; a missing float is created from `location.rect`. */
const place = (layout: Layout, ref: WidgetRef, location: Location, activate: boolean): Layout => {
  if (location.kind === 'slot') {
    return updateSlot(layout, location.slot, (stack) =>
      insertTab(stack, ref, location.index, activate),
    );
  }
  const existing = layout.floats.find((float) => float.id === location.floatId);
  if (existing) {
    return {
      ...layout,
      floats: layout.floats.map((float) =>
        float.id === location.floatId
          ? { ...float, stack: insertTab(float.stack, ref, location.index, activate) }
          : float,
      ),
    };
  }
  if (!location.rect) throw new LayoutError(`Floating window ${location.floatId} does not exist`);
  const float: FloatWindow = {
    id: location.floatId,
    ...normalizeRect(location.rect),
    z: nextZ(layout),
    stack: { tabs: [ref], active: ref.instanceId },
  };
  const floats = [...layout.floats, float].sort((a, b) => a.id.localeCompare(b.id));
  return { ...layout, floats };
};

/** Removes a widget; an emptied float disappears. */
const unplace = (
  layout: Layout,
  instanceId: string,
  options: { keepMaximized?: boolean } = {},
): Layout => {
  const found = findWidget(layout, instanceId);
  if (!found) throw new LayoutError(`No widget ${instanceId} in the layout`);
  let next: Layout;
  if (found.location.kind === 'slot') {
    next = updateSlot(layout, found.location.slot, (stack) => removeTab(stack, instanceId));
  } else {
    const floatId = found.location.floatId;
    next = {
      ...layout,
      floats: layout.floats
        .map((float) =>
          float.id === floatId ? { ...float, stack: removeTab(float.stack, instanceId) } : float,
        )
        .filter((float) => float.stack.tabs.length > 0),
    };
  }
  return next.maximized === instanceId && !options.keepMaximized
    ? { ...next, maximized: null }
    : next;
};

const normalizeRect = (rect: Rect): Rect => ({
  x: Math.round(rect.x),
  y: Math.round(rect.y),
  width: Math.round(Math.max(MIN_FLOAT.width, rect.width)),
  height: Math.round(Math.max(MIN_FLOAT.height, rect.height)),
});

/**
 * Applies an operation. Pure: returns the new layout and the operation undoing it.
 * Throws `LayoutError` for operations that do not apply to this layout.
 */
export const reduce = (layout: Layout, op: LayoutOp): Reduction => {
  switch (op.type) {
    case 'add': {
      if (findWidget(layout, op.ref.instanceId))
        throw new LayoutError(`${op.ref.instanceId} is already in the layout`);
      return {
        layout: place(layout, op.ref, op.location, op.activate ?? true),
        inverse: withActivation({ type: 'remove', instanceId: op.ref.instanceId }, [
          activeAt(layout, op.location),
        ]),
      };
    }
    case 'remove': {
      const found = findWidget(layout, op.instanceId);
      if (!found) throw new LayoutError(`No widget ${op.instanceId} in the layout`);
      const maximized = layout.maximized === op.instanceId;
      const inverse: LayoutOp = {
        type: 'add',
        ref: found.ref,
        location: found.location,
        activate: found.active,
      };
      return {
        layout: unplace(layout, op.instanceId),
        inverse: maximized
          ? { type: 'batch', ops: [inverse, { type: 'maximize', instanceId: op.instanceId }] }
          : inverse,
      };
    }
    case 'move': {
      const found = findWidget(layout, op.instanceId);
      if (!found) throw new LayoutError(`No widget ${op.instanceId} in the layout`);
      const removed = unplace(layout, op.instanceId, { keepMaximized: true });
      const requested = op.location;
      const target: Location =
        requested.kind === 'float' &&
        !requested.rect &&
        found.location.kind === 'float' &&
        found.location.floatId === requested.floatId &&
        !removed.floats.some((float) => float.id === requested.floatId)
          ? { ...requested, ...(found.location.rect && { rect: found.location.rect }) }
          : requested;
      return {
        layout: place(removed, found.ref, target, op.activate ?? true),
        inverse: withActivation(
          {
            type: 'move',
            instanceId: op.instanceId,
            location: found.location,
            activate: found.active,
          },
          [activeAt(layout, op.location), activeAt(layout, found.location)],
        ),
      };
    }
    case 'activate': {
      const found = findWidget(layout, op.instanceId);
      if (!found) throw new LayoutError(`No widget ${op.instanceId} in the layout`);
      const previousActive =
        found.location.kind === 'slot'
          ? layout.slots[found.location.slot].stack.active
          : layout.floats.find(
              (float) => float.id === (found.location as { floatId: string }).floatId,
            )!.stack.active;
      const setActive = (stack: TabStack): TabStack => ({ ...stack, active: op.instanceId });
      const next =
        found.location.kind === 'slot'
          ? updateSlot(layout, found.location.slot, setActive)
          : {
              ...layout,
              floats: layout.floats.map((float) =>
                float.id === (found.location as { floatId: string }).floatId
                  ? { ...float, stack: setActive(float.stack) }
                  : float,
              ),
            };
      return {
        layout: next,
        inverse: previousActive
          ? { type: 'activate', instanceId: previousActive }
          : { type: 'batch', ops: [] },
      };
    }
    case 'resizeSlot': {
      const previous = layout.slots[op.slot].size;
      return {
        layout: {
          ...layout,
          slots: {
            ...layout.slots,
            [op.slot]: {
              ...layout.slots[op.slot],
              size: Math.max(MIN_SLOT_SIZE, Math.round(op.size)),
            },
          },
        },
        inverse: { type: 'resizeSlot', slot: op.slot, size: previous },
      };
    }
    case 'setSplit': {
      const previous = layout.split[op.side];
      return {
        layout: { ...layout, split: { ...layout.split, [op.side]: clamp(op.ratio, 0.15, 0.85) } },
        inverse: { type: 'setSplit', side: op.side, ratio: previous },
      };
    }
    case 'toggleSlot': {
      const previous = layout.slots[op.slot].visible;
      return {
        layout: {
          ...layout,
          slots: { ...layout.slots, [op.slot]: { ...layout.slots[op.slot], visible: op.visible } },
        },
        inverse: { type: 'toggleSlot', slot: op.slot, visible: previous },
      };
    }
    case 'setFloatRect': {
      const float = layout.floats.find((candidate) => candidate.id === op.floatId);
      if (!float) throw new LayoutError(`Floating window ${op.floatId} does not exist`);
      const rect = normalizeRect(op.rect);
      return {
        layout: {
          ...layout,
          floats: layout.floats.map((candidate) =>
            candidate === float ? { ...candidate, ...rect } : candidate,
          ),
        },
        inverse: {
          type: 'setFloatRect',
          floatId: op.floatId,
          rect: { x: float.x, y: float.y, width: float.width, height: float.height },
        },
      };
    }
    case 'focusFloat': {
      const float = layout.floats.find((candidate) => candidate.id === op.floatId);
      if (!float) throw new LayoutError(`Floating window ${op.floatId} does not exist`);
      return {
        layout: {
          ...layout,
          floats: layout.floats.map((candidate) =>
            candidate === float ? { ...candidate, z: op.z } : candidate,
          ),
        },
        inverse: { type: 'focusFloat', floatId: op.floatId, z: float.z },
      };
    }
    case 'switchScreen': {
      if (op.screen !== null && !layout.screens.includes(op.screen))
        throw new LayoutError(`Unknown screen ${op.screen}`);
      return {
        layout: { ...layout, activeScreen: op.screen },
        inverse: { type: 'switchScreen', screen: layout.activeScreen },
      };
    }
    case 'setScreens': {
      const activeScreen =
        layout.activeScreen && op.screens.includes(layout.activeScreen)
          ? layout.activeScreen
          : (op.screens[0] ?? null);
      return {
        layout: { ...layout, screens: [...op.screens], activeScreen },
        inverse: {
          type: 'batch',
          ops: [
            { type: 'setScreens', screens: layout.screens },
            { type: 'switchScreen', screen: layout.activeScreen },
          ],
        },
      };
    }
    case 'maximize': {
      if (op.instanceId !== null && !findWidget(layout, op.instanceId))
        throw new LayoutError(`No widget ${op.instanceId} in the layout`);
      return {
        layout: { ...layout, maximized: op.instanceId },
        inverse: { type: 'maximize', instanceId: layout.maximized },
      };
    }
    case 'setScreenOverride': {
      const current = layout.screenOverrides[op.screen] ?? {};
      const previous = current[op.slot];
      const overrides = Object.fromEntries(
        Object.entries({ ...current, [op.slot]: op.visible }).filter(
          ([, visible]) => visible !== null,
        ),
      ) as Partial<Record<SlotId, boolean>>;
      return {
        layout: {
          ...layout,
          screenOverrides: { ...layout.screenOverrides, [op.screen]: overrides },
        },
        inverse: {
          type: 'setScreenOverride',
          screen: op.screen,
          slot: op.slot,
          visible: previous ?? null,
        },
      };
    }
    case 'batch': {
      let current = layout;
      const inverses: LayoutOp[] = [];
      for (const inner of op.ops) {
        const result = reduce(current, inner);
        current = result.layout;
        inverses.unshift(result.inverse);
      }
      return { layout: current, inverse: { type: 'batch', ops: inverses } };
    }
  }
};
