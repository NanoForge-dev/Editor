<script lang="ts">
  import { CurrentDirectory } from './store';
  import type { FileSystemFile } from '@utils-client/file-system';
  import { FileSystemDirectory } from '@utils-client/file-system';
  import {
    contentBrowserItemType,
    type ContentBrowserItemType,
  } from '$lib/components/Widget/ContentBrowser/types';

  interface Props {
    name: string;
    handle: FileSystemDirectory | FileSystemFile;
  }
  let { name, handle }: Props = $props();

  function getFileType(file: string): ContentBrowserItemType | undefined {
    return contentBrowserItemType.find((type) => file.endsWith(type.suffix));
  }
</script>

<button
  class="h-32 w-24 flex flex-col cursor-pointer items-center rounded-md p-1 hover:bg-neutral-700"
  onclick={() =>
    handle instanceof FileSystemDirectory
      ? ($CurrentDirectory = handle)
      : getFileType(name)?.onClickEvent?.(handle)}
>
  <span class="w-full aspect-square bg-neutral-900 flex items-center justify-center rounded p-2">
    <span
      class="w-full h-full {handle instanceof FileSystemDirectory
        ? contentBrowserItemType[0].icon
        : getFileType(name)?.icon
          ? getFileType(name)?.icon
          : 'i-ic-round-insert-drive-file'} text-neutral-600 text-2xl"
    ></span>
  </span>
  <span class="my-2 w-full text-neutral-300 text-sm text-truncate">{name}</span>
</button>
