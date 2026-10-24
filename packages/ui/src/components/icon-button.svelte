<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  import Icon from './icon.svelte';

  interface Props extends HTMLButtonAttributes {
    icon: string;
    /** Accessible name, also shown as tooltip. */
    label: string;
    pressed?: boolean;
    size?: number;
  }

  const { icon, label, pressed, size = 16, type = 'button', ...rest }: Props = $props();
</script>

<button
  class="icon-button"
  class:pressed
  {type}
  aria-label={label}
  title={label}
  aria-pressed={pressed === undefined ? undefined : pressed}
  {...rest}
>
  <Icon name={icon} {size} />
</button>

<style>
  .icon-button {
    display: inline-grid;
    place-items: center;
    width: var(--nf-control-height);
    height: var(--nf-control-height);
    padding: 0;
    border: 0;
    border-radius: var(--nf-radius-control);
    background: transparent;
    color: var(--nf-color-text-muted);
    cursor: pointer;
  }
  .icon-button:hover:not(:disabled) {
    background: var(--nf-color-hover);
    color: var(--nf-color-text);
  }
  .pressed {
    background: var(--nf-color-pressed);
    color: var(--nf-color-text);
  }
  .icon-button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
