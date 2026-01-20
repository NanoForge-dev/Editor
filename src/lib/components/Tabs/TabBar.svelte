<script lang="ts">
  import TabComponent from './Tab.svelte';
  import { type Tab } from './types';

  interface Props {
    tabs: Tab[];
    selected: number;
  }
  let { tabs = $bindable(), selected = $bindable(0) }: Props = $props();
</script>

<div class="w-full flex gap-1">
  {#each tabs as tab, index (tab)}
    <TabComponent
      {tab}
      selected={selected === index}
      closable={tab.type.name !== 'main'}
      onSelect={() => (selected = index)}
      onClose={() => tabs.splice(index, 1)}
    />
  {/each}
</div>
