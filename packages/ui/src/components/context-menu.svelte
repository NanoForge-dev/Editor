<script lang="ts">
  import { ContextMenu as BitsContextMenu } from 'bits-ui';
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

<BitsContextMenu.Root onOpenChange={(open) => open && (entries = items())}>
  <BitsContextMenu.Trigger class="nf-context-area">
    {@render children()}
  </BitsContextMenu.Trigger>
  <BitsContextMenu.Portal>
    <BitsContextMenu.Content class="nf-popover nf-menu">
      {#each entries as entry, index (index)}
        {#if entry.kind === 'separator'}
          <BitsContextMenu.Separator class="nf-menu-separator" />
        {:else if entry.kind === 'submenu'}
          <BitsContextMenu.Sub>
            <BitsContextMenu.SubTrigger class="nf-menu-item" disabled={entry.disabled ?? false}>
              <span class="nf-menu-check"></span>
              <span class="nf-menu-label">{entry.label}</span>
              <Icon name="chevron-right" size={14} />
            </BitsContextMenu.SubTrigger>
            <BitsContextMenu.SubContent class="nf-popover nf-menu">
              {#each entry.items as child, childIndex (childIndex)}
                {#if child.kind === 'item'}
                  <BitsContextMenu.Item
                    class="nf-menu-item"
                    disabled={child.disabled ?? false}
                    onSelect={child.onSelect}
                  >
                    <span class="nf-menu-check"></span>
                    <span class="nf-menu-label">{child.label}</span>
                  </BitsContextMenu.Item>
                {:else if child.kind === 'separator'}
                  <BitsContextMenu.Separator class="nf-menu-separator" />
                {/if}
              {/each}
            </BitsContextMenu.SubContent>
          </BitsContextMenu.Sub>
        {:else}
          <BitsContextMenu.Item
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
          </BitsContextMenu.Item>
        {/if}
      {/each}
    </BitsContextMenu.Content>
  </BitsContextMenu.Portal>
</BitsContextMenu.Root>
