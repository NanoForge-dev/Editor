export interface TabType {
  name: string;
  icon: string;
}

export interface Tab {
  type: TabType;
  title: string;
}

export const tabTypes: TabType[] = [
  { name: 'main', icon: 'i-material-icon-theme-huff' },
  { name: 'ts', icon: 'i-material-icon-theme-typescript' },
  { name: '3d', icon: 'i-material-icon-theme-3d' },
  { name: 'song', icon: 'i-material-icon-theme-lyric' },
];
