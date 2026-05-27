<script lang="ts">
  import ContentBrowserContentItem from './content-item.svelte';
  import { currentDir } from './store';
  import type { ContentBrowserItem } from './types';

  interface Props {
    items: ContentBrowserItem[];
  }
  let { items: baseItems }: Props = $props();

  const items = $derived.by(() => {
    if (!$currentDir) return baseItems;
    let res = baseItems;
    for (const dir of $currentDir.split('/')) {
      const found = res.find(({ name }) => name === dir);
      if (!found) throw new Error('Directory not found: ' + dir);
      if (found.type !== 'dir') throw new Error('Not a directory: ' + dir);
      res = found.children;
    }
    return res;
  });
</script>

<div class="h-full rounded-l-sm rounded-r-md bg-neutral-900 overflow-hidden">
  <div class="h-full w-full flex flex-wrap content-start items-start gap-2 overflow-y-auto p-2">
    {#each items as item (item.name)}
      <ContentBrowserContentItem {item} />
    {/each}
  </div>
</div>
