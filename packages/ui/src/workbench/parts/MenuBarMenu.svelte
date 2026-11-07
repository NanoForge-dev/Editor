<script lang="ts">
  import Menu from '../../components/menu.svelte';
  import type { MenuEntry } from '../../components/menu-entry.type';
  import { getWorkbenchContext } from '../workbench-context';
  import { resolveMenu } from '../menu/resolve-menu';

  const { id, title }: { id: string; title: string } = $props();
  const context = getWorkbenchContext();
  let open = $state(false);
  let items = $state<MenuEntry[]>([]);

  $effect(() => {
    if (open) items = resolveMenu(context, id);
  });
</script>

<Menu bind:open {items}>
  {#snippet trigger({ props })}
    <button type="button" class="menu-button" {...props}>{title}</button>
  {/snippet}
</Menu>

<style>
  .menu-button {
    height: 24px;
    padding: 0 var(--nf-space-2);
    border: 0;
    border-radius: var(--nf-radius-control);
    background: transparent;
    color: var(--nf-color-text-muted);
    cursor: default;
  }
  .menu-button:hover,
  .menu-button[data-state='open'] {
    background: var(--nf-color-hover);
    color: var(--nf-color-text);
  }
</style>
