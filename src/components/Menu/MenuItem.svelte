<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Avatar, DropdownItem } from 'flowbite-svelte';

  interface Props {
    icon?: string;
    children?: Snippet;
  }
  let { icon, children }: Props = $props();
</script>

<DropdownItem
  class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-neutral-600 text-xs text-white"
>
  <Avatar class="{icon || 'opacity-0'} w-4 h-4 text-xs text-neutral-200 rounded-none" />
  {@render children?.()}
</DropdownItem>
