<script lang="ts">
  import { ContextMenu } from 'bits-ui';
  import type { Snippet } from 'svelte';

  import Icon from './icon.svelte';
  import type { MenuEntry } from './menu-entry.type';

  interface Props {
    /** Computed when the menu opens (entries can depend on the clicked element). */
    items: () => readonly MenuEntry[];
    children: Snippet;
  }

  const { items, children }: Props = $props();
  let entries = $state<readonly MenuEntry[]>([]);
</script>

<ContextMenu.Root onOpenChange={(open) => open && (entries = items())}>
  <ContextMenu.Trigger class="nf-context-area">
    {@render children()}
  </ContextMenu.Trigger>
  <ContextMenu.Portal>
    <ContextMenu.Content class="nf-popover nf-menu">
      {#each entries as entry, index (index)}
        {#if entry.kind === 'separator'}
          <ContextMenu.Separator class="nf-menu-separator" />
        {:else if entry.kind === 'submenu'}
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger class="nf-menu-item" disabled={entry.disabled ?? false}>
              <span class="nf-menu-check"></span>
              <span class="nf-menu-label">{entry.label}</span>
              <Icon name="chevron-right" size={14} />
            </ContextMenu.SubTrigger>
            <ContextMenu.SubContent class="nf-popover nf-menu">
              {#each entry.items as child, childIndex (childIndex)}
                {#if child.kind === 'item'}
                  <ContextMenu.Item
                    class="nf-menu-item"
                    disabled={child.disabled ?? false}
                    onSelect={child.onSelect}
                  >
                    <span class="nf-menu-check"></span>
                    <span class="nf-menu-label">{child.label}</span>
                  </ContextMenu.Item>
                {:else if child.kind === 'separator'}
                  <ContextMenu.Separator class="nf-menu-separator" />
                {/if}
              {/each}
            </ContextMenu.SubContent>
          </ContextMenu.Sub>
        {:else}
          <ContextMenu.Item
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
          </ContextMenu.Item>
        {/if}
      {/each}
    </ContextMenu.Content>
  </ContextMenu.Portal>
</ContextMenu.Root>
