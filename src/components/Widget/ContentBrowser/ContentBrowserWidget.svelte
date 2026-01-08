<script lang="ts">
  import type { ContentBrowserItem } from './types';
  import ContentBrowserListFolder from './ContentBrowserListFolder.svelte';
  import ContentBrowserItemCard from './ContentBrowserItemCard.svelte';

  let items: ContentBrowserItem[] = [
    {
      id: 'id1',
      name: 'Content',
      type: 'folder',
      children: [
        {
          id: 'id2',
          name: 'JumpOut',
          type: 'folder',
          children: [
            {
              id: 'id3',
              name: 'Player',
              type: 'folder',
              children: [
                {
                  id: 'id4',
                  name: 'Meshes',
                  type: 'folder',
                  children: [
                    {
                      id: 'id5',
                      name: 'Character.fbx',
                      type: 'fbx',
                    },
                  ],
                },
                {
                  id: 'id6',
                  name: 'Player.ts',
                  type: 'ts',
                },
              ],
            },
          ],
        },
      ],
    },
  ];
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

<div class="flex gap-1 w-full h-full bg-neutral-800 p-1">
  <div class="flex flex-col w-1/5 bg-neutral-900 rounded-l-md rounded-r-sm p-1">
    {#each items as item (item)}
      <ContentBrowserListFolder {item} select={(ids) => (selected = ids)} bind:selected />
    {/each}
  </div>
  <div class="flex flex-col h-full w-full">
    <div class="h-fit flex px-1 pt-1 pb-2 items-center">
      {#each selected as id, index (id)}
        <button
          class="text-xs py-1 px-2 cursor-pointer hover:bg-neutral-700 rounded-lg"
          onclick={() => (selected = selected.slice(0, selected.indexOf(id) + 1))}
          >{findRecursive(items, id)?.name || 'unknown'}</button
        >
        {#if index + 1 < selected.length}
          <span class="i-solar-alt-arrow-right-linear my-auto mx-2 font-bold text-sm"></span>
        {/if}
      {/each}
    </div>
    <div class="bg-neutral-900 w-full h-full rounded-r-md rounded-l-sm flex gap-2 p-2">
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
