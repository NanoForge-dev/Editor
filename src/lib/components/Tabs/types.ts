import type { Component } from 'svelte';

export type TabTypeId = 'main' | 'ts' | '3d' | 'song' | 'img' | 'unknown';

export interface Tab {
  id: TabTypeId;
  icon: string;
  component: Component<any>;
}

export interface TabInstance {
  id: string;
  type: TabTypeId;
  title: string;
  metadata?: {
    path?: string;
  };
}

export interface TabsState {
  tabs: TabInstance[];
  selectedTabId: string | null;
}
