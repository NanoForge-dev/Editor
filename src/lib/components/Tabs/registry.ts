import CodeEditor from './CodeEditor/CodeEditor.svelte';
import MainTab from './MainTab/MainTab.svelte';
import type { Tab } from './types';

export const tabRegistry: Record<string, Tab> = {
  main: {
    id: 'main',
    icon: 'i-material-icon-theme-huff',
    component: MainTab,
  },
  ts: {
    id: 'ts',
    icon: 'i-material-icon-theme-typescript',
    component: CodeEditor,
  },
  '3d': {
    id: '3d',
    icon: 'i-material-icon-theme-3d',
    component: MainTab,
  },
  song: {
    id: 'song',
    icon: 'i-material-icon-theme-lyric',
    component: MainTab,
  },
};
