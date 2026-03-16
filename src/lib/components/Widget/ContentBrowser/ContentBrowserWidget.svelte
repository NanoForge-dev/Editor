<script lang="ts">
  import ContentBrowserItemCard from './ContentBrowserItemCard.svelte';
  import { onMount } from 'svelte';
  import { type FolderContent, listFolderContents } from '$lib/components/Storage/fileSystem';
  import {
    type ContentBrowserItemType,
    contentBrowserItemType,
  } from '$lib/components/Widget/ContentBrowser/types';
  import { ContentBrowserPath } from '$lib/components/Widget/ContentBrowser/store';
  import ContentBrowserListFolder from '$lib/components/Widget/ContentBrowser/ContentBrowserListFolder.svelte';

  let contents:
    | Array<{ name: string; type: 'file' | 'folder'; lastModified?: number }>
    | undefined = $state();

  function navigateToFolder(folder: string) {
    $ContentBrowserPath = [...$ContentBrowserPath, folder];
  }

  function getFileType(file: string): ContentBrowserItemType | undefined {
    return contentBrowserItemType.find((type) => file.endsWith(type.suffix));
  }

  let rootFolderContent: FolderContent[] = $state([]);

  onMount(() => {
    let folderContents = $derived(listFolderContents($ContentBrowserPath.join('/')));
    listFolderContents('/').then((result) => {
      rootFolderContent = result;
    });

    $effect(() => {
      folderContents.then((result) => {
        contents = result;
      });
    });
  });
</script>

<div class="h-full w-full flex gap-1 bg-neutral-800 p-1">
  <div class="w-1/5 flex flex-col rounded-l-md rounded-r-sm bg-neutral-900 p-1">
    {#if contents}
      {#each rootFolderContent.filter((folder) => folder.type === 'folder') as folder (folder)}
        <ContentBrowserListFolder {folder} />
      {/each}
    {/if}
  </div>
  <div class="h-full w-4/5 flex flex-col">
    <div class="h-fit flex items-center px-1 pb-2 pt-1">
      {#each ['Content', ...$ContentBrowserPath] as folder, index (folder)}
        <button
          class="cursor-pointer rounded-lg px-2 py-1 text-xs hover:bg-neutral-700"
          onclick={() => ($ContentBrowserPath = $ContentBrowserPath.slice(0, index))}
          >{folder}</button
        >
        {#if index < $ContentBrowserPath.length}
          <span class="i-solar-alt-arrow-right-linear mx-2 my-auto font-bold text-sm"></span>
        {/if}
      {/each}
    </div>
    <div
      class="h-full w-full flex gap-2 rounded-l-sm rounded-r-md bg-neutral-900 p-2 flex-wrap overflow-y-scroll"
    >
      {#if contents}
        {#each contents as content (content)}
          <ContentBrowserItemCard
            item={content}
            onClickEvent={() => {
              if (content.type === 'folder') {
                navigateToFolder(content.name);
              } else {
                const itemType = getFileType(content.name);
                itemType?.onClickEvent?.([...$ContentBrowserPath, content.name].join('/'));
              }
            }}
          />
        {/each}
      {/if}
    </div>
  </div>
</div>
