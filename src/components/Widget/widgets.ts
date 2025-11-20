import type { Component } from 'svelte';

import ContentBrowserWidget from './ContentBrowser/ContentBrowserWidget.svelte';
import EntitiesTreeWidget from './EntitiesTree/EntitiesTreeWidget.svelte';
import EntityDetailsWidget from './EntityDetails/EntityDetailsWidget.svelte';
import ScreenView from './ScreenView/ScreenViewWidget.svelte';

export interface WidgetType {
  id: string;
  component: Component;
}

export const widgetsTypes: WidgetType[] = [
  {
    id: 'content-browser',
    component: ContentBrowserWidget,
  },
  {
    id: 'screen-view',
    component: ScreenView,
  },
  {
    id: 'entities-tree',
    component: EntitiesTreeWidget,
  },
  {
    id: 'entity-details',
    component: EntityDetailsWidget,
  },
];
