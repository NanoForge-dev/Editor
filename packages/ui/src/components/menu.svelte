<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import type { Snippet } from 'svelte';

  import MenuEntries from './MenuEntries.svelte';
  import type { MenuEntry } from './menu-entry.type';

  interface Props {
    items: readonly MenuEntry[];
    /** Renders the trigger; spread `props` on the trigger element. */
    trigger: Snippet<[{ props: Record<string, unknown> }]>;
    open?: boolean;
    align?: 'start' | 'center' | 'end';
  }

  let { items, trigger, open = $bindable(false), align = 'start' }: Props = $props();
</script>

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      {@render trigger({ props })}
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content class="nf-popover nf-menu" {align} sideOffset={2}>
      <MenuEntries {items} />
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
