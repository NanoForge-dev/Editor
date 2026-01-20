<script lang="ts">
  import type { ContentBrowserItem } from './types';
  import ContentBrowserListFolder from './ContentBrowserListFolder.svelte';
  import ContentBrowserItemCard from './ContentBrowserItemCard.svelte';
  import { entities } from '../../demo/entities';

  let items = entities;
  let selected: string[] = $state(['id1']);

  function findRecursive(items: ContentBrowserItem[], id: string): ContentBrowserItem | undefined {
    for (const item of items) {
      if (item.id === id) return item;

      if (item.children) {
        const found = findRecursive(item.children, id);
        if (found) return found;
      }
    }
  }

  let selectedContent = $derived(findRecursive(items, selected.at(-1) || ''));
</script>

<div class="h-full w-full flex gap-1 bg-neutral-800 p-1">
  <div class="w-1/5 flex flex-col rounded-l-md rounded-r-sm bg-neutral-900 p-1">
    {#each items as item (item)}
      <ContentBrowserListFolder {item} select={(ids) => (selected = ids)} bind:selected />
    {/each}
  </div>
  <div class="h-full w-full flex flex-col">
    <div class="h-fit flex items-center px-1 pb-2 pt-1">
      {#each selected as id, index (id)}
        <button
          class="cursor-pointer rounded-lg px-2 py-1 text-xs hover:bg-neutral-700"
          onclick={() => (selected = selected.slice(0, selected.indexOf(id) + 1))}
          >{findRecursive(items, id)?.name || 'unknown'}</button
        >
        {#if index + 1 < selected.length}
          <span class="i-solar-alt-arrow-right-linear mx-2 my-auto font-bold text-sm"></span>
        {/if}
      {/each}
    </div>
    <div class="h-full w-full flex gap-2 rounded-l-sm rounded-r-md bg-neutral-900 p-2">
      {#if selectedContent && selectedContent.children}
        {#each selectedContent.children as item (item)}
          <ContentBrowserItemCard
            {item}
            select={item.type === 'folder' ? () => selected.push(item.id) : () => {}}
          />
        {/each}
      {/if}
    </div>
  </div>
</div>
