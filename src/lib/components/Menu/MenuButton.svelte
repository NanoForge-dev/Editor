<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Button, Dropdown } from 'flowbite-svelte';

  interface Props {
    title: string;
    children?: Snippet;
  }
  let { title, children }: Props = $props();

  let isOpen = $state(false);
</script>

<div>
  <Button
    class="cursor-pointer rounded-none py-1 hover:bg-neutral-800 {isOpen
      ? 'bg-neutral-800 '
      : ''} px-4 text-xs text-white font-normal"
  >
    {title}
  </Button>
  <Dropdown
    bind:isOpen
    simple
    placement="bottom-start"
    class="rounded-tl-none bg-neutral-800 text-white"
    transitionParams={{ duration: 0 }}
    offset={0}
  >
    {@render children?.()}
  </Dropdown>
</div>
