<script lang="ts">
  import TabComponent from './Tab.svelte';
  import { type Types, tabTypes } from '../types';

  let tabs: Types[] = $state([
    { type: tabTypes[0], title: 'Game' },
    { type: tabTypes[2], title: 'Player.obj' },
    { type: tabTypes[1], title: 'main.ts' },
    { type: tabTypes[3], title: 'original-sound-track.wav' },
  ]);
  let selected = $state(0);
</script>

<div class="flex gap-1 w-full">
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
