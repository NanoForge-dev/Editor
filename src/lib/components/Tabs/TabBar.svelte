<script lang="ts">
  import TabComponent from './Tab.svelte';
  import { tabSelectedStore, tabsStore } from '$lib/components/Stores/tabs';
  import type { Tab } from '$lib/components/Tabs/types';
  import { workingFileStore } from '$lib/components/Stores/workingFile';

  let tabs: Tab[] = $derived($tabsStore);
</script>

<div class="w-full flex gap-1">
  {#each tabs as tab, index (tab)}
    <TabComponent
      {tab}
      selected={$tabSelectedStore === index}
      closable={tab.type.name !== 'main'}
      onSelect={() => {
        tabSelectedStore.set(index);
        workingFileStore.set(tabs[index].filePath || '');
      }}
      onClose={() => tabsStore.update((tabs) => tabs.splice(index, 1))}
    />
  {/each}
</div>
