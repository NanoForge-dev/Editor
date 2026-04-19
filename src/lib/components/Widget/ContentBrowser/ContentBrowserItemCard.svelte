<script lang="ts">
  import { CurrentDirectory } from './store';
  import type { FileSystemFile } from '@utils-client/file-system';
  import { FileSystemDirectory } from '@utils-client/file-system';
  import {
    type ContentBrowserItemType,
    contentBrowserItemType,
  } from '$lib/components/Widget/ContentBrowser/types';
  import { tabsStore } from '$lib/components/Tabs/store';
  import type { TabTypeId } from '$lib/components/Tabs/types';
  import { onMount } from 'svelte';

  interface Props {
    name: string;
    handle: FileSystemDirectory | FileSystemFile;
  }
  let { name, handle }: Props = $props();

  let fileType: ContentBrowserItemType | undefined = $state();

  function OpenItem() {
    if (handle instanceof FileSystemDirectory) {
      $CurrentDirectory = handle;
      return;
    }

    let tabType = contentBrowserItemType.find((type) => handle.getName().endsWith(type.suffix))
      ?.type as TabTypeId | undefined;
    if (!tabType) return;

    tabsStore.openTab({
      type: tabType,
      title: handle.getName(),
      file: handle,
    });
  }

  onMount(() => {
    fileType = contentBrowserItemType.find((type) => handle.getName().endsWith(type.suffix));
  });
</script>

<button
  class="h-32 w-24 flex flex-col cursor-pointer items-center rounded-md p-1 hover:bg-neutral-700"
  onclick={OpenItem}
>
  <span class="w-full aspect-square bg-neutral-900 flex items-center justify-center rounded p-2">
    <span
      class="w-full h-full {handle instanceof FileSystemDirectory
        ? contentBrowserItemType[0].icon
        : fileType?.icon
          ? fileType.icon
          : 'i-ic-round-insert-drive-file'} text-neutral-600 text-2xl"
    ></span>
  </span>
  <span class="my-2 w-full text-neutral-300 text-sm text-truncate">{name}</span>
</button>
