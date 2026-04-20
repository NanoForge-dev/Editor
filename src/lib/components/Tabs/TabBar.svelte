<script lang="ts">
  import Tab from './Tab.svelte';
  import { tabsStore } from './store';
  import { tabRegistry } from './registry';

  let state = $derived($tabsStore);
</script>

<div class="flex w-full gap-1 overflow-x-auto">
  {#each state.tabs as tab (tab.id)}
    <Tab
      {tab}
      meta={tabRegistry[tab.type]}
      selected={state.selectedTabId === tab.id}
      closable={tab.type !== 'main'}
      onSelect={() => tabsStore.selectTab(tab.id)}
      onClose={() => tabsStore.closeTab(tab.id)}
    />
  {/each}
</div>
