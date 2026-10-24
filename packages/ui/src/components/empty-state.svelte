<script lang="ts">
  import type { Snippet } from 'svelte';

  import Icon from './icon.svelte';

  interface Props {
    icon?: string;
    title: string;
    description?: string;
    actions?: Snippet;
  }

  const { icon, title, description, actions }: Props = $props();
</script>

<div class="empty">
  {#if icon}<span class="icon"><Icon name={icon} size={28} /></span>{/if}
  <p class="title">{title}</p>
  {#if description}<p class="description">{description}</p>{/if}
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
  .empty {
    display: grid;
    justify-items: center;
    align-content: center;
    gap: var(--nf-space-2);
    height: 100%;
    padding: var(--nf-space-5);
    text-align: center;
  }
  .icon {
    color: var(--nf-color-text-faint);
  }
  .title {
    margin: 0;
    font-weight: 500;
  }
  .description {
    margin: 0;
    max-width: 36ch;
    color: var(--nf-color-text-muted);
  }
  .actions {
    display: flex;
    gap: var(--nf-space-2);
    margin-top: var(--nf-space-2);
  }
</style>
