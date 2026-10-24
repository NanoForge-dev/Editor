import type { Component } from 'svelte';
import { z } from 'zod';

import { type ExtensionPoint, defineExtensionPoint } from '@nanoforge-dev/editor-kernel';
import { SLOT_IDS, type SlotId } from '@nanoforge-dev/editor-layout';

import type { WidgetInstance } from '../widget/widget-instance.type';

const SLOT = z.enum(SLOT_IDS);

/**
 * What a widget is (metadata only): declared in manifests (`contributes.widgets`) or in code,
 * so layouts, menus and the widget list know it before its plugin activates.
 */
export const WidgetDescriptorSchema = z.object({
  id: z.string().regex(/^[a-z0-9][\w/.-]*$/),
  title: z.string().min(1),
  /** Lucide icon name, e.g. `folder-tree`. */
  icon: z.string().optional(),
  /** `screen`: main screen in the center; `dock`: panel in a dock slot or floating window. */
  kind: z.enum(['dock', 'screen']).default('dock'),
  defaultSlot: SLOT.optional(),
  order: z.number().default(0),
  openByDefault: z.boolean().default(true),
  /** Only one instance at a time (default). */
  singleton: z.boolean().default(true),
  /** Offered in menus only when true. */
  when: z.string().optional(),
  /** History context of the widget (undo/redo target while focused). */
  historyContext: z.string().optional(),
});
export type WidgetDescriptor = z.output<typeof WidgetDescriptorSchema> & {
  readonly defaultSlot?: SlotId;
};

export const WIDGETS: ExtensionPoint<WidgetDescriptor> = defineExtensionPoint('ui.widgets', {
  validator: WidgetDescriptorSchema as unknown as z.ZodType<WidgetDescriptor>,
});

/** What a framework-agnostic widget returns when mounted. */
export interface MountedWidget {
  dispose(): void;
}

/** How a widget renders (registered by its plugin on activation). */
export interface WidgetView {
  readonly id: string;
  /** Svelte component receiving `{ instance }`. */
  readonly component?: Component<{ instance: WidgetInstance }>;
  /** Framework-agnostic alternative. */
  readonly mount?: (element: HTMLElement, instance: WidgetInstance) => MountedWidget;
  /** CSS scoped to the widget (`[data-nf-widget="<id>"]`), in the plugin's cascade layer. */
  readonly styles?: string;
}

export const WIDGET_VIEWS: ExtensionPoint<WidgetView> = defineExtensionPoint('ui.widgetViews');
