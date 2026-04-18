<script lang="ts">
  import Self from './ContentBrowserListFolder.svelte';
  import { CurrentDirectory } from '$lib/components/Widget/ContentBrowser/store';
  import { onMount } from 'svelte';
  import { FileSystemDirectory } from '@utils-client/file-system';
  import type {
    FileSystemMapDirectoryChildren,
    FileSystemMapEntry,
    FileSystemMapEntryDirectory,
  } from '@utils-client/file-system/file-system-directory';

  interface Props {
    name: string;
    directory: FileSystemDirectory;
    root: FileSystemDirectory;
  }
  let { name, directory, root }: Props = $props();

  let isCurrentDirectoryParent: boolean = $state(false);
  let open: boolean = $state(false);
  let deepness: number = $state(0);

  let childFolders: FileSystemMapDirectoryChildren = $state(new Map());

  function isDirectory(entry: FileSystemMapEntry): entry is FileSystemMapEntryDirectory {
    return entry[1] instanceof FileSystemDirectory;
  }

  onMount(async () => {
    childFolders = new Map((await directory.getChildren()).entries().filter(isDirectory));
    deepness = (await directory.getParents(root))?.length || 0;
  });

  $effect(() => {
    $CurrentDirectory.getParents(root).then(async (parents) => {
      if (!parents) {
        isCurrentDirectoryParent = false;
        return;
      }

      isCurrentDirectoryParent = false;

      for (const p of parents) {
        if (await p.handle.isSameEntry(directory.handle)) {
          isCurrentDirectoryParent = true;
          open = true;
          break;
        }
      }
    });
  });
</script>

<button
  class="h-7 flex cursor-pointer items-center gap-1 text-neutral-200 text-md hover:bg-neutral-800 {isCurrentDirectoryParent
    ? 'bg-neutral-800'
    : 'bg-none'}"
  style={`padding-left: ${deepness * 8}px`}
  onclick={() => ($CurrentDirectory = directory)}
>
  {#if childFolders.size > 0}
    <span
      onclick={(e) => {
        e.stopPropagation();
        open = !open;
      }}
      aria-hidden="true"
      class="{open
        ? 'i-solar-alt-arrow-down-bold'
        : 'i-solar-alt-arrow-right-bold'} w-4 text-center select-none text-neutral-400 hover:text-neutral-200"
    ></span>
  {:else}
    <span class="w-4"></span>
  {/if}
  <span class="i-material-icon-theme-folder-interceptor"></span>
  <span class="text-sm text-neutral-200">{name}</span>
</button>

{#if open && childFolders.size > 0}
  {#each childFolders as [childName, handle] (childName)}
    <Self name={childName} directory={handle} {root} />
  {/each}
{/if}
