import { type FileSystemFile } from '@utils-client/file-system';

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
  onClickEvent?: (file: FileSystemFile) => void;
}

export const contentBrowserItemType: ContentBrowserItemType[] = [
  { type: 'folder', suffix: '/', icon: 'i-material-icon-theme-folder-interceptor' },
  {
    type: 'ts',
    suffix: '.ts',
    icon: 'i-material-icon-theme-typescript',
    // Tabs to fix
    /*onClickEvent: (file: FileSystemFile) => {
      workingFileStore.set(filePath);
      tabsStore.update((tabs) => [
        ...tabs,
        { type: tabTypes[1], title: filePath.split('/').pop() || filePath, filePath },
      ]);
      tabSelectedStore.set(get(tabsStore).length - 1);
    },*/
  },
  { type: 'fbx', suffix: '.fbx', icon: 'i-material-icon-theme-3d' },
  { type: 'song', suffix: '.mp3', icon: 'i-material-icon-theme-lyric' },
  { type: 'json', suffix: '.json', icon: 'i-material-icon-theme-json' },
  { type: 'git', suffix: '.gitignore', icon: 'i-material-icon-theme-git' },
];
