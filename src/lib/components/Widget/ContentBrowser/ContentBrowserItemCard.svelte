<script lang="ts">
  import { contentBrowserItemType } from './types';

  interface Props {
    item: { name: string; type: 'file' | 'folder' };
    onClickEvent?: () => void;
  }
  let { item = $bindable(), onClickEvent }: Props = $props();

  let type =
    item.type === 'folder'
      ? contentBrowserItemType[0]
      : contentBrowserItemType.find((type) => item.name.endsWith(type.suffix));
</script>

<button
  class="h-32 w-24 flex flex-col cursor-pointer items-center rounded-md p-1 hover:bg-neutral-700"
  onclick={onClickEvent}
>
  <span class="w-full aspect-square bg-neutral-900 flex items-center justify-center rounded p-2">
    <span
      class="w-full h-full {type
        ? type.icon
        : 'i-ic-round-insert-drive-file'} text-neutral-600 text-2xl"
    ></span>
  </span>
  <span class="my-2 w-full text-neutral-300 text-sm text-truncate">{item.name}</span>
</button>
