import type { Component } from 'svelte';

import ContentBrowserWidget from './ContentBrowser/ContentBrowserWidget.svelte';

export interface WidgetType {
  id: string;
  component: Component;
}

export const widgetsTypes: WidgetType[] = [
  {
    id: 'content-browser',
    component: ContentBrowserWidget,
  },
];
