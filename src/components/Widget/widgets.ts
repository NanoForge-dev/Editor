import type { Component } from 'svelte';

import MonacoEditor from './CodeEditor/MonacoEditor.svelte';
import ComponentsInspectorWidget from './ComponentsInspector/ComponentsInspectorWidget.svelte';
import ContentBrowserWidget from './ContentBrowser/ContentBrowserWidget.svelte';
import EntitiesTreeWidget from './EntitiesTree/EntitiesTreeWidget.svelte';
import OutputLogWidget from './OutputLog/OutputLogWidget.svelte';
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
    id: 'components-inspector',
    component: ComponentsInspectorWidget,
  },
  {
    id: 'code-editor',
    component: MonacoEditor,
  },
  {
    id: 'output-log',
    component: OutputLogWidget,
  },
];
