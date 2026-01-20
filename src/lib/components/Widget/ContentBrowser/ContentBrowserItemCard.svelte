<script lang="ts">
  import { type ContentBrowserItem, contentBrowserItemType } from './types';

  interface Props {
    item: ContentBrowserItem;
    select: () => void;
  }
  let { item, select }: Props = $props();
</script>

<button
  class="h-32 w-24 flex flex-col cursor-pointer items-center rounded-md p-1 hover:bg-neutral-700"
  onclick={select}
>
  <span
    class="{contentBrowserItemType.find((t) => t.type === item.type)
      ?.icon} w-full h-full rounded-md bg-neutral-900"
  ></span>
  <span class="my-2 text-neutral-300 text-sm">{item.name}</span>
</button>
