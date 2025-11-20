<script lang="ts">
  import { type ContentBrowserItem, contentBrowserItemType } from './types';

  interface Props {
    item: ContentBrowserItem;
    select: () => void;
  }
  let { item, select }: Props = $props();
</script>

<button
  class="rounded-md hover:bg-neutral-700 h-32 w-24 flex flex-col items-center cursor-pointer p-1"
  onclick={select}
>
  <span
    class="{contentBrowserItemType.find((t) => t.type === item.type)
      ?.icon} w-full h-full rounded-md bg-neutral-900"
  ></span>
  <span class="my-2 text-neutral-300 text-sm">{item.name}</span>
</button>
