<script lang="ts">
  import ContentBrowserItemCard from './ContentBrowserItemCard.svelte';
  import { onMount } from 'svelte';
  import { CurrentDirectory } from '$lib/components/Widget/ContentBrowser/store';
  import ContentBrowserListFolder from '$lib/components/Widget/ContentBrowser/ContentBrowserListFolder.svelte';
  import { projectFileSystem } from '@utils-client/local-file-system/project-file-system';
  import {
    type FileSystemMapChildren,
    type FileSystemMapEntry,
    type FileSystemMapEntryDirectory,
    FileSystemDirectory,
  } from '@utils-client/file-system/file-system-directory';

  let contents: FileSystemMapChildren = $state(new Map());
  let foldersParent: FileSystemDirectory[] = $state([]);
  let loadId = 0;

  let rootDirectoryHandle: FileSystemDirectory | undefined = $state();
  let rootDirectoryChildren: FileSystemMapChildren = $state(new Map());

  function isDirectory(entry: FileSystemMapEntry): entry is FileSystemMapEntryDirectory {
    return entry[1] instanceof FileSystemDirectory;
  }

  onMount(async () => {
    rootDirectoryHandle = await projectFileSystem.getDirectory('/');
    $CurrentDirectory = rootDirectoryHandle;
    rootDirectoryChildren = await rootDirectoryHandle.getChildren();
  });

  $effect(() => {
    const dir = $CurrentDirectory;
    const root = rootDirectoryHandle;
    const id = ++loadId;

    if (!dir) {
      contents.clear();
      foldersParent = [];
      return;
    }

    dir.getChildren().then((c) => {
      if (id !== loadId) return;
      contents = c;
    });

    if (!root) return;

    dir.getParents(root).then((p) => {
      foldersParent = p ? p : [];
    });
  });
</script>

<div class="h-full w-full flex gap-1 bg-neutral-800 p-1">
  <div class="w-1/5 flex flex-col rounded-l-md rounded-r-sm bg-neutral-900 p-1">
    {#if contents && rootDirectoryHandle}
      {#each rootDirectoryChildren.entries().filter(isDirectory) as [name, handle] (name)}
        <ContentBrowserListFolder {name} directory={handle} root={rootDirectoryHandle} />
      {/each}
    {/if}
  </div>
  <div class="h-full w-4/5 flex flex-col">
    <div class="h-fit flex items-center px-1 pb-2 pt-1">
      <button
        class="cursor-pointer rounded-lg px-2 py-1 text-xs hover:bg-neutral-700"
        onclick={() => (rootDirectoryHandle ? ($CurrentDirectory = rootDirectoryHandle) : {})}
        >Content</button
      >
      {#each foldersParent as folder, index (folder)}
        {#if index < foldersParent.length}
          <span class="i-solar-alt-arrow-right-linear mx-2 my-auto font-bold text-sm"></span>
        {/if}
        <button
          class="cursor-pointer rounded-lg px-2 py-1 text-xs hover:bg-neutral-700"
          onclick={() => ($CurrentDirectory = folder)}>{folder.name}</button
        >
      {/each}
    </div>
    <div class="h-full rounded-l-sm rounded-r-md bg-neutral-900 overflow-hidden">
      <div class="h-full w-full flex flex-wrap content-start items-start gap-2 overflow-y-auto p-2">
        {#if contents}
          {#each contents as [name, handle] (name)}
            <ContentBrowserItemCard {name} {handle} />
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>
