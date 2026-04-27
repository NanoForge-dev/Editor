import type { Component } from 'svelte';

import MonacoEditor from './CodeEditor/MonacoEditor.svelte';
import ComponentsInspectorWidget from './ComponentsInspector/ComponentsInspectorWidget.svelte';
import ContentBrowserWidget from './ContentBrowser/ContentBrowserWidget.svelte';
import EditorGame from './EditorGame/EditorGame.svelte';
import EntitiesTreeWidget from './EntitiesTree/EntitiesTreeWidget.svelte';
import OutputLogWidget from './OutputLog/OutputLogWidget.svelte';

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
  {
    id: 'editor-game',
    component: EditorGame,
  },
];
