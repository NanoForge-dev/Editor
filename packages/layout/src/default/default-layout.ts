import { emptyLayout } from '../model/empty-layout';
import type { Layout } from '../model/layout.type';
import type { SlotId } from '../model/slot-id.enum';
import type { LayoutOp } from '../operations/layout-op.type';
import { reduce } from '../operations/reduce';

export interface WidgetPlacement {
  readonly id: string;
  readonly kind: 'dock' | 'screen';
  /** Where a dock widget goes by default (ignored for screens). */
  readonly defaultSlot?: SlotId;
  /** Order in its slot (docks) or in the screen switcher (screens). */
  readonly order?: number;
  /** Docks: shown in the default layout (default true). */
  readonly openByDefault?: boolean;
}

/** The layout used when nothing is saved: screens in order, docks in their default slots. */
export const composeDefaultLayout = (widgets: readonly WidgetPlacement[]): Layout => {
  const byOrder = (a: WidgetPlacement, b: WidgetPlacement) =>
    (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id);
  const screens = widgets.filter((widget) => widget.kind === 'screen').sort(byOrder);
  const docks = widgets
    .filter((widget) => widget.kind === 'dock' && widget.openByDefault !== false)
    .sort(byOrder);
  const ops: LayoutOp[] = [{ type: 'setScreens', screens: screens.map((screen) => screen.id) }];
  const counts: Partial<Record<SlotId, number>> = {};
  for (const dock of docks) {
    const slot = dock.defaultSlot ?? 'leftTop';
    const index = counts[slot] ?? 0;
    counts[slot] = index + 1;
    ops.push({
      type: 'add',
      ref: { instanceId: dock.id, widgetId: dock.id },
      location: { kind: 'slot', slot, index },
      activate: index === 0,
    });
  }
  return reduce(emptyLayout(), { type: 'batch', ops }).layout;
};

/** Adds screens and default docks that a saved layout does not know yet (new plugins). */
export const reconcileLayout = (
  layout: Layout,
  widgets: readonly WidgetPlacement[],
  known: ReadonlySet<string>,
): Layout => {
  const byOrder = (a: WidgetPlacement, b: WidgetPlacement) =>
    (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id);
  const screens = widgets
    .filter((widget) => widget.kind === 'screen')
    .sort(byOrder)
    .map((widget) => widget.id);
  const merged = [
    ...layout.screens.filter((screen) => screens.includes(screen)),
    ...screens.filter((screen) => !layout.screens.includes(screen)),
  ];
  const ops: LayoutOp[] = [{ type: 'setScreens', screens: merged }];
  let next = reduce(layout, { type: 'batch', ops }).layout;
  for (const dock of widgets.filter(
    (widget) => widget.kind === 'dock' && !known.has(widget.id) && widget.openByDefault !== false,
  )) {
    const slot = dock.defaultSlot ?? 'leftTop';
    next = reduce(next, {
      type: 'add',
      ref: { instanceId: dock.id, widgetId: dock.id },
      location: { kind: 'slot', slot, index: next.slots[slot].stack.tabs.length },
      activate: false,
    }).layout;
  }
  return next;
};
