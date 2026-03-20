import type { Component } from 'svelte';

import CodeEditor from './CodeEditor/CodeEditor.svelte';
import MainTab from './MainTab/MainTab.svelte';

export interface TabType {
  name: string;
  icon: string;
  component: Component<{ tab: Tab }>;
}

export interface Tab {
  type: TabType;
  title: string;
  filePath?: string;
  content?: string;
}

export const tabTypes: TabType[] = [
  { name: 'main', icon: 'i-material-icon-theme-huff', component: MainTab },
  { name: 'ts', icon: 'i-material-icon-theme-typescript', component: CodeEditor },
  { name: '3d', icon: 'i-material-icon-theme-3d', component: MainTab },
  { name: 'song', icon: 'i-material-icon-theme-lyric', component: MainTab },
];
