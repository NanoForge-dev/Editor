<script lang="ts">
  import { contentBrowserItemType } from './types';

  interface Props {
    item: string;
  }
  let { item }: Props = $props();

  let type = contentBrowserItemType.find((type) => item.endsWith(type.suffix));
</script>

<button
  class="h-32 w-24 flex flex-col cursor-pointer items-center rounded-md p-1 hover:bg-neutral-700"
  onclick={() => (type?.onClickEvent ? type.onClickEvent(item) : undefined)}
>
  <span class="{type?.icon} w-full h-full rounded-md bg-neutral-900"></span>
  <span class="my-2 text-neutral-300 text-sm">{item}</span>
</button>
