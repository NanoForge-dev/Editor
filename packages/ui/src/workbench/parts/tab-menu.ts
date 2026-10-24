import { SLOT_IDS, type SlotId, findWidget } from '@nanoforge-dev/editor-layout';

import type { MenuEntry } from '../../components/menu-entry.type';
import type { LayoutController } from '../layout/layout-controller';

export const SLOT_LABELS: Record<SlotId, string> = {
  leftTop: 'Left top',
  leftBottom: 'Left bottom',
  rightTop: 'Right top',
  rightBottom: 'Right bottom',
  bottom: 'Bottom left',
  bottomRight: 'Bottom right',
};

/** The menu of a dock tab (stripe icon, panel header, floating window tab). */
export const tabMenu = (
  layout: LayoutController,
  instanceId: string,
  title: string,
  run: (promise: Promise<unknown>) => void,
): MenuEntry[] => {
  const found = findWidget(layout.current, instanceId);
  if (!found) return [];
  const { location } = found;
  const stack =
    location.kind === 'slot'
      ? layout.current.slots[location.slot].stack
      : layout.current.floats.find((float) => float.id === location.floatId)!.stack;
  const slot = location.kind === 'slot' ? location.slot : undefined;
  const maximized = layout.current.maximized === instanceId;
  return [
    ...(slot
      ? [
          {
            kind: 'item' as const,
            id: 'hide',
            label: 'Hide',
            onSelect: () => layout.showSlot(slot, false),
          },
        ]
      : []),
    { kind: 'item', id: 'close', label: 'Close', onSelect: () => run(layout.close(instanceId)) },
    {
      kind: 'item',
      id: 'close-others',
      label: 'Close others',
      disabled: stack.tabs.length < 2,
      onSelect: () =>
        run(
          layout.apply(
            {
              type: 'batch',
              ops: stack.tabs
                .filter((tab) => tab.instanceId !== instanceId)
                .map((tab) => ({ type: 'remove' as const, instanceId: tab.instanceId })),
            },
            'Close other panels',
          ),
        ),
    },
    { kind: 'separator' },
    {
      kind: 'item',
      id: 'float',
      label: 'Float',
      disabled: location.kind === 'float' && stack.tabs.length === 1,
      onSelect: () => run(layout.float(instanceId, { x: 160, y: 120, width: 420, height: 320 })),
    },
    {
      kind: 'submenu',
      label: 'Move to',
      items: SLOT_IDS.filter((target) => target !== slot).map((target) => ({
        kind: 'item' as const,
        id: target,
        label: SLOT_LABELS[target],
        onSelect: () =>
          run(
            layout
              .apply(
                {
                  type: 'move',
                  instanceId,
                  location: {
                    kind: 'slot',
                    slot: target,
                    index: layout.current.slots[target].stack.tabs.length,
                  },
                },
                `Move ${title}`,
              )
              .then(() => layout.focusTab(instanceId)),
          ),
      })),
    },
    {
      kind: 'item',
      id: 'maximize',
      label: maximized ? 'Restore' : 'Maximize',
      onSelect: () =>
        run(layout.apply({ type: 'maximize', instanceId: maximized ? null : instanceId })),
    },
  ];
};
