<script lang="ts">
  import type { Snippet } from 'svelte';
  import { DropdownMenuItem } from '$lib/components/ui/dropdown-menu';

  interface Props {
    icon?: string;
    link?: string;
    children?: Snippet;
    onClick?: () => void;
  }
  let { icon, link, children, onClick }: Props = $props();
</script>

<div>
  <DropdownMenuItem class="p-0 w-full">
    {#if link}
      <a
        href={link}
        class="flex cursor-pointer items-center gap-2 px-3 py-2 text-white text-xs hover:bg-neutral-600 w-full"
      >
        <span class="{icon || 'opacity-0'} w-4 h-4 text-xs text-neutral-200 rounded-none"></span>
        {@render children?.()}
      </a>
    {:else}
      <button
        class="flex cursor-pointer items-center gap-2 px-3 py-2 text-white text-xs hover:bg-neutral-600 w-full"
        onclick={onClick}
      >
        <span class="{icon || 'opacity-0'} w-4 h-4 text-xs text-neutral-200 rounded-none"></span>
        {@render children?.()}
      </button>
    {/if}
  </DropdownMenuItem>
</div>
