<script lang="ts">
  import Icon from './icon.svelte';

  interface Props {
    items: readonly { id: string; label: string; icon?: string }[];
    active: string;
    onchange?: (id: string) => void;
    label: string;
  }

  const { items, active, onchange, label }: Props = $props();

  const onkeydown = (event: KeyboardEvent) => {
    const index = items.findIndex((item) => item.id === active);
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta || index < 0) return;
    event.preventDefault();
    const next = items[(index + delta + items.length) % items.length]!;
    onchange?.(next.id);
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLElement>(`[data-tab="${CSS.escape(next.id)}"]`)
      ?.focus();
  };
</script>

<div class="tabs" role="tablist" aria-label={label} tabindex="-1" {onkeydown}>
  {#each items as item (item.id)}
    <button
      type="button"
      role="tab"
      class="tab"
      data-tab={item.id}
      aria-selected={item.id === active}
      tabindex={item.id === active ? 0 : -1}
      onclick={() => onchange?.(item.id)}
    >
      {#if item.icon}<Icon name={item.icon} size={14} />{/if}
      {item.label}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 2px;
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: var(--nf-space-1);
    height: var(--nf-control-height);
    padding: 0 var(--nf-space-3);
    border: 0;
    border-radius: var(--nf-radius-control);
    background: transparent;
    color: var(--nf-color-text-muted);
    cursor: pointer;
  }
  .tab:hover {
    color: var(--nf-color-text);
    background: var(--nf-color-hover);
  }
  .tab[aria-selected='true'] {
    background: var(--nf-color-pressed);
    color: var(--nf-color-text);
  }
</style>
