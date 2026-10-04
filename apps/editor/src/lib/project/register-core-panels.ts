import type { Component } from 'svelte';

import {
  type Disposable,
  DisposableStore,
  type ExtensionRegistry,
} from '@nanoforge-dev/editor-kernel';
import {
  WIDGETS,
  WIDGET_VIEWS,
  WidgetDescriptorSchema,
  type WidgetInstance,
} from '@nanoforge-dev/editor-ui';

import ProjectOverview from './ProjectOverview.svelte';

const PANELS = [
  {
    id: 'core.project',
    title: 'Project',
    icon: 'layers',
    kind: 'screen',
    order: 100,
    component: ProjectOverview,
  },
] as const;

/**
 * Panels of the editor itself. Plugins of later phases replace or complement them
 * (file manager, history panel…).
 */
export const registerCorePanels = (extensions: ExtensionRegistry): Disposable => {
  const store = new DisposableStore();
  for (const { component, ...descriptor } of PANELS) {
    store.add(
      extensions.contribute(WIDGETS, WidgetDescriptorSchema.parse(descriptor), { owner: 'core' }),
    );
    store.add(
      extensions.contribute(
        WIDGET_VIEWS,
        { id: descriptor.id, component: component as Component<{ instance: WidgetInstance }> },
        { owner: 'core' },
      ),
    );
  }
  return store;
};
