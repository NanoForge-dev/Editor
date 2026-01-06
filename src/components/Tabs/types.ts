import type { Component } from 'svelte';

import MainTab from './MainTab/MainTab.svelte';

export interface TabType {
  name: string;
  icon: string;
  component: Component;
}

export interface Tab {
  type: TabType;
  title: string;
}

export const tabTypes: TabType[] = [
  { name: 'main', icon: 'i-material-icon-theme-huff', component: MainTab },
  { name: 'ts', icon: 'i-material-icon-theme-typescript', component: MainTab },
  { name: '3d', icon: 'i-material-icon-theme-3d', component: MainTab },
  { name: 'song', icon: 'i-material-icon-theme-lyric', component: MainTab },
];
