<script lang="ts">
  import ContentBrowserList from './ContentBrowserList.svelte';
  import { entities } from '../../demo/entities';

  let items = entities;
  let selected: string[] = $state(['id1']);
</script>

<div class="flex gap-1 w-full h-full bg-neutral-800 p-1">
  <div class="flex flex-col w-full bg-neutral-900 rounded-l-md rounded-r-sm p-1">
    {#each items as item (item)}
      <ContentBrowserList
        {item}
        select={(ids) => (selected = ids)}
        bind:selected
        onlyFolder={false}
      />
    {/each}
  </div>
</div>
