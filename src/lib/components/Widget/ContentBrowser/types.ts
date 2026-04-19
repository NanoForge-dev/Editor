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
}

export const contentBrowserItemType: ContentBrowserItemType[] = [
  { type: 'folder', suffix: '/', icon: 'i-material-icon-theme-folder-interceptor' },
  {
    type: 'ts',
    suffix: '.ts',
    icon: 'i-material-icon-theme-typescript',
  },
  { type: 'fbx', suffix: '.fbx', icon: 'i-material-icon-theme-3d' },
  { type: 'song', suffix: '.mp3', icon: 'i-material-icon-theme-lyric' },
  { type: 'json', suffix: '.json', icon: 'i-material-icon-theme-json' },
  { type: 'git', suffix: '.gitignore', icon: 'i-material-icon-theme-git' },
];
