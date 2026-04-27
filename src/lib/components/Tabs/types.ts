import type { Component } from 'svelte';

import type { FileSystemFile } from '@utils-client/file-system';

export type TabTypeId = 'main' | 'ts' | '3d' | 'song';

export interface Tab {
  id: TabTypeId;
  icon: string;
  component: Component<any>;
}

export interface TabInstance {
  id: string;
  type: TabTypeId;
  title: string;
  file?: FileSystemFile;
}

export interface TabsState {
  tabs: TabInstance[];
  selectedTabId: string | null;
}
