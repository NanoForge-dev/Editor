import type { Component } from 'svelte';

import MonacoEditor from './CodeEditor/MonacoEditor.svelte';
import EditorGame from './EditorGame/EditorGame.svelte';
import OutputLogWidget from './OutputLog/OutputLogWidget.svelte';
import { ContentBrowserWidget } from './content-browser';
import { ECSTreeWidget } from './ecs-tree';
import { EntityInspectorWidget } from './entity-inspector';

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
    component: MonacoEditor as Component,
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
