<script lang="ts">
  import Self from './ContentBrowserListFolder.svelte';
  import { type FolderContent, listFolderContents } from '$lib/components/Storage/fileSystem';
  import { ContentBrowserPath } from '$lib/components/Widget/ContentBrowser/store';
  import { onMount } from 'svelte';

  interface Props {
    folder: FolderContent;
    deepness?: number;
  }
  let { folder, deepness = 0 }: Props = $props();

  let open: boolean = $state($ContentBrowserPath.join('/').startsWith(folder.name));

  let childFolders: FolderContent[] = $derived([]);

  onMount(() => {
    $effect(() => {
      listFolderContents(folder.name).then((contents: FolderContent[]) => {
        childFolders = contents.filter((c) => c.type === 'folder');
      });
    });
    $effect(() => {
      if ($ContentBrowserPath.join('/').startsWith(folder.name)) {
        open = true;
      }
    });
  });
</script>

<button
  class="h-7 flex cursor-pointer items-center gap-1 text-neutral-200 text-md hover:bg-neutral-800"
  style={`padding-left: ${deepness * 8}px`}
  onclick={() => ($ContentBrowserPath = folder.name.split('/'))}
>
  {#if childFolders.length > 0}
    <span
      onclick={() => (open = !open)}
      aria-hidden="true"
      class="{open
        ? 'i-solar-alt-arrow-down-bold'
        : 'i-solar-alt-arrow-right-bold'} w-4 text-center select-none text-neutral-400 hover:text-neutral-200"
    ></span>
  {:else}
    <span class="w-2"></span>
  {/if}
  <span class="i-material-icon-theme-folder-interceptor"></span>
  <span>{folder.name}</span>
</button>

{#if open && childFolders.length > 0}
  {#each childFolders as child, i (i)}
    <Self folder={child} deepness={deepness + 1} />
  {/each}
{/if}
