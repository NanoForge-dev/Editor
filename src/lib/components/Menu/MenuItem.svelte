<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Avatar, DropdownItem } from 'flowbite-svelte';

  interface Props {
    icon?: string;
    children?: Snippet;
    onClick?: () => void;
  }
  let { icon, children, onClick }: Props = $props();
</script>

<div>
  <DropdownItem class="p-0 w-full">
    <button
      class="flex cursor-pointer items-center gap-2 px-3 py-2 text-white text-xs hover:bg-neutral-600 w-full"
      onclick={onClick}
    >
      <Avatar class="{icon || 'opacity-0'} w-4 h-4 text-xs text-neutral-200 rounded-none" />
      {@render children?.()}
    </button>
  </DropdownItem>
</div>
