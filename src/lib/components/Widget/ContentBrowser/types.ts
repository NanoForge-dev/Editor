import { tabSelectedStore, tabsStore } from '$lib/components/Stores/tabs';
import { tabTypes } from '$lib/components/Tabs/types';

export interface ContentBrowserItem {
  id: string;
  name: string;
  type: string;
  children?: ContentBrowserItem[];
}

export interface ContentBrowserItemType {
  type: string;
  suffix: string;
  icon: string;
  onClickEvent?: (filePath: string) => void;
}

export const contentBrowserItemType: ContentBrowserItemType[] = [
  { type: 'folder', suffix: '/', icon: 'i-material-icon-theme-folder-interceptor' },
  {
    type: 'ts',
    suffix: '.ts',
    icon: 'i-material-icon-theme-typescript',
    onClickEvent: (filePath: string) => {
      tabsStore.update((tabs) => [
        ...tabs,
        { type: tabTypes[1], title: filePath.split('/').pop() || filePath, filePath },
      ]);
      tabSelectedStore.update((tabSelected) => tabSelected + 1);
    },
  },
  { type: 'fbx', suffix: '.fbx', icon: 'i-material-icon-theme-3d' },
  { type: 'song', suffix: '.mp3', icon: 'i-material-icon-theme-lyric' },
];
