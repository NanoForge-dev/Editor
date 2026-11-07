<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  import Icon from './icon.svelte';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md';
    icon?: string;
    children?: Snippet;
  }

  const {
    variant = 'secondary',
    size = 'md',
    icon,
    children,
    type = 'button',
    ...rest
  }: Props = $props();
</script>

<button class="button {variant} {size}" {type} {...rest}>
  {#if icon}<Icon name={icon} size={size === 'sm' ? 14 : 16} />{/if}
  {#if children}<span>{@render children()}</span>{/if}
</button>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--nf-space-2);
    height: var(--nf-control-height);
    padding: 0 var(--nf-space-3);
    border: 1px solid transparent;
    border-radius: var(--nf-radius-control);
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color var(--nf-motion-fast),
      border-color var(--nf-motion-fast);
  }
  .sm {
    height: 22px;
    padding: 0 var(--nf-space-2);
    font-size: var(--nf-font-size-sm);
  }
  .primary {
    background: var(--nf-color-accent);
    color: var(--nf-color-on-accent);
  }
  .primary:hover:not(:disabled) {
    background: var(--nf-color-accent-hover);
  }
  .secondary {
    background: var(--nf-color-raised);
    border-color: var(--nf-color-border);
  }
  .secondary:hover:not(:disabled) {
    border-color: var(--nf-color-border-strong);
    background: var(--nf-color-hover);
  }
  .ghost {
    background: transparent;
  }
  .ghost:hover:not(:disabled) {
    background: var(--nf-color-hover);
  }
  .danger {
    background: transparent;
    border-color: var(--nf-color-danger);
    color: var(--nf-color-danger);
  }
  .danger:hover:not(:disabled) {
    background: var(--nf-color-danger);
    color: var(--nf-color-bg);
  }
  .button:active:not(:disabled) {
    translate: 0 1px;
  }
  .button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
