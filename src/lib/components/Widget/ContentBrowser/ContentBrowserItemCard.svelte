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
  <span class="{type?.icon} w-full h-full rounded-md bg-neutral-900"></span>
  <span class="my-2 text-neutral-300 text-sm">{item.name}</span>
</button>
