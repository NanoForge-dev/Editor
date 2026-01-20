<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Avatar, DropdownItem } from 'flowbite-svelte';

  interface Props {
    icon?: string;
    children?: Snippet;
  }
  let { icon, children }: Props = $props();
</script>

<div>
  <DropdownItem
    class="flex cursor-pointer items-center gap-2 px-3 py-2 text-white text-xs hover:bg-neutral-600"
  >
    <Avatar class="{icon || 'opacity-0'} w-4 h-4 text-xs text-neutral-200 rounded-none" />
    {@render children?.()}
  </DropdownItem>
</div>
