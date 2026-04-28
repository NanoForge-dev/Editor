import type { Component } from 'svelte';

import MonacoEditor from './CodeEditor/MonacoEditor.svelte';
import ContentBrowserWidget from './ContentBrowser/ContentBrowserWidget.svelte';
import ECSTreeWidget from './ECSTree/ECSTree.svelte';
import EditorGame from './EditorGame/EditorGame.svelte';
import EntityInspectorWidget from './EntityInspector/EntityInspectorWidget.svelte';
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
    id: 'ecs-tree',
    component: ECSTreeWidget,
  },
  {
    id: 'entity-inspector',
    component: EntityInspectorWidget,
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
