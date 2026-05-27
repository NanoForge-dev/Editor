<script lang="ts">
  import ContentBrowserSideItem from './side-item.svelte';
  import type { ContentBrowserItemDir } from './types';
  import { joinPath } from './utils';

  interface Props {
    path: string;
    items: ContentBrowserItemDir[];
    tab?: number;
  }
  let { path, items, tab = 0 }: Props = $props();

  const getPath = (name: string) => joinPath(path, name);
</script>

{#each items as item (getPath(item.name))}
  <ContentBrowserSideItem path={getPath(item.name)} {item} {tab} />
{/each}
