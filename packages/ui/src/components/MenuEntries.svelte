<script lang="ts">
  import { DropdownMenu } from 'bits-ui';

  import Icon from './icon.svelte';
  import MenuEntries from './MenuEntries.svelte';
  import type { MenuEntry } from './menu-entry.type';

  const { items }: { items: readonly MenuEntry[] } = $props();
</script>

{#each items as entry, index (index)}
  {#if entry.kind === 'separator'}
    <DropdownMenu.Separator class="nf-menu-separator" />
  {:else if entry.kind === 'submenu'}
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger class="nf-menu-item" disabled={entry.disabled ?? false}>
        <span class="nf-menu-check"></span>
        <span class="nf-menu-label">{entry.label}</span>
        <Icon name="chevron-right" size={14} />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent class="nf-popover nf-menu" sideOffset={2}>
        <MenuEntries items={entry.items} />
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  {:else}
    <DropdownMenu.Item
      class="nf-menu-item"
      disabled={entry.disabled ?? false}
      onSelect={entry.onSelect}
    >
      <span class="nf-menu-check">
        {#if entry.checked}<Icon name="check" size={14} />{:else if entry.icon}<Icon
            name={entry.icon}
            size={14}
          />{/if}
      </span>
      <span class="nf-menu-label">{entry.label}</span>
      {#if entry.shortcut}<kbd class="nf-menu-shortcut">{entry.shortcut}</kbd>{/if}
    </DropdownMenu.Item>
  {/if}
{/each}
