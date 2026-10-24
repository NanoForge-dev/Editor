<script lang="ts">
  import Button from '../../src/components/button.svelte';
  import Menu from '../../src/components/menu.svelte';
  import type { MenuEntry } from '../../src/components/menu-entry.type';

  const { items }: { items: MenuEntry[] } = $props();
</script>

<Menu {items}>
  {#snippet trigger({ props })}
    <Button {...props}>File</Button>
  {/snippet}
</Menu>
