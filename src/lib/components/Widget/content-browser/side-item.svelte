<script lang="ts">
  import ContentBrowserIcon from './icon.svelte';
  import ContentBrowserSideList from './side-list.svelte';
  import { currentDir } from './store';
  import { type ContentBrowserItemDir } from './types';

  interface Props {
    path: string;
    item: ContentBrowserItemDir;
    tab: number;
  }
  let { path, item, tab }: Props = $props();

  const handleOpen = (e: Event) => {
    e.stopPropagation();
    currentDir.set(path);
  };

  const open = $derived($currentDir.startsWith(path));
  const children = $derived(item.children.filter((i) => i.type === 'dir'));
</script>

<button
  class="h-7 flex items-center justify-start text-left gap-1 text-neutral-200 text-md hover:bg-neutral-800 text-nowrap cursor-pointer"
  style={`padding-left: ${tab * 8}px`}
  onclick={handleOpen}
>
  {#if children.length > 0}
    <span
      aria-hidden="true"
      class="{open
        ? 'i-solar-alt-arrow-down-bold'
        : 'i-solar-alt-arrow-right-bold'} w-4 text-center select-none text-neutral-400 hover:text-neutral-200"
    ></span>
  {:else}
    <span class="w-4"></span>
  {/if}
  <ContentBrowserIcon {item} />

  <span class="text-sm text-neutral-200 truncate w-full">{item.name}</span>
</button>

{#if open}
  <ContentBrowserSideList {path} items={children} tab={tab + 1} />
{/if}
