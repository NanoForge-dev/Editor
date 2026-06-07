<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
  } from '$lib/components/ui/dropdown-menu';

  interface Props {
    title: string;
    children?: Snippet;
  }
  let { title, children }: Props = $props();

  let isOpen = $state(false);
</script>

<div>
  <DropdownMenu>
    <DropdownMenuTrigger>
      <Button
        variant="ghost"
        class="rounded-none py-1 hover:bg-neutral-800 {isOpen
          ? 'bg-neutral-800 '
          : ''} px-4 text-xs text-white font-normal"
      >
        {title}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-40">
      {@render children?.()}
    </DropdownMenuContent>
  </DropdownMenu>
</div>
