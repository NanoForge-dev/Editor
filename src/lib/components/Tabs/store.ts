import { persistedWritable } from '$lib/components/Utils/LocalStorage/persistedWritable';
import { get } from 'svelte/store';

import type { TabInstance, TabsState } from './types';

const initialState: TabsState = {
  tabs: [
    {
      id: 'tab-main',
      type: 'main',
      title: 'Game',
    },
  ],
  selectedTabId: 'tab-main',
};

function createTabsStore() {
  const { subscribe, update, set } = persistedWritable<TabsState>('editor.tabs', initialState);

  async function openTab(tab: Omit<TabInstance, 'id'> & { id?: string }) {
    const existing = await findExistingTab(tab);

    if (existing) {
      update((state) => ({
        ...state,
        selectedTabId: existing.id,
      }));
      return;
    }

    const newTab: TabInstance = {
      ...tab,
      id: tab.id ?? crypto.randomUUID(),
    };

    update((state) => ({
      tabs: [...state.tabs, newTab],
      selectedTabId: newTab.id,
    }));
  }

  function closeTab(tabId: string) {
    update((state) => {
      const index = state.tabs.findIndex((t) => t.id === tabId);
      if (index === -1) return state;

      const closingTab = state.tabs[index];
      if (closingTab.type === 'main') return state;

      const isSelected = state.selectedTabId === tabId;
      const nextTabs = state.tabs.filter((t) => t.id !== tabId);

      if (!isSelected) {
        return { ...state, tabs: nextTabs };
      }

      const nextSelected =
        nextTabs[index]?.id ?? nextTabs[index - 1]?.id ?? nextTabs[0]?.id ?? null;

      return {
        tabs: nextTabs,
        selectedTabId: nextSelected,
      };
    });
  }

  function selectTab(tabId: string) {
    update((state) => ({
      ...state,
      selectedTabId: tabId,
    }));
  }

  function moveTab(fromId: string, toId: string) {
    update((state) => {
      const from = state.tabs.findIndex((t) => t.id === fromId);
      const to = state.tabs.findIndex((t) => t.id === toId);
      if (from === -1 || to === -1 || from === to) return state;

      const tabs = [...state.tabs];
      const [item] = tabs.splice(from, 1);
      tabs.splice(to, 0, item);

      return { ...state, tabs };
    });
  }

  function reset() {
    set(initialState);
  }

  async function findExistingTab(
    tab: Omit<TabInstance, 'id'> & { id?: string },
  ): Promise<TabInstance | undefined> {
    const tabs = get({ subscribe }).tabs;
    if (tab.file) {
      for (const t of tabs) {
        if (!t.file) continue;

        if (await t.file.isSameFile(tab.file)) {
          return t;
        }
      }

      return undefined;
    }

    if (tab.id) {
      return tabs.find((t) => t.id === tab.id);
    }

    return undefined;
  }

  return {
    subscribe,
    openTab,
    closeTab,
    selectTab,
    moveTab,
    reset,
  };
}

export const tabsStore = createTabsStore();
