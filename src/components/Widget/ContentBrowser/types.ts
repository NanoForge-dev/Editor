export interface ContentBrowserItem {
  id: string;
  name: string;
  type: string;
  children?: ContentBrowserItem[];
}

export interface ContentBrowserItemType {
  type: string;
  icon: string;
}

export const contentBrowserItemType: ContentBrowserItemType[] = [
  { type: 'folder', icon: 'i-material-icon-theme-folder-interceptor' },
  { type: 'ts', icon: 'i-material-icon-theme-typescript' },
  { type: 'fbx', icon: 'i-material-icon-theme-3d' },
  { type: 'song', icon: 'i-material-icon-theme-lyric' },
];
