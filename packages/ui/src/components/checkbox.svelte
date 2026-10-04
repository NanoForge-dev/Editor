<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    children?: Snippet;
    onchange?: (checked: boolean) => void;
  }

  let { checked = $bindable(false), disabled = false, label, children, onchange }: Props = $props();
</script>

<label class="checkbox" class:disabled>
  <input
    type="checkbox"
    bind:checked
    {disabled}
    aria-label={children ? undefined : label}
    onchange={() => onchange?.(checked)}
  />
  {#if children}<span>{@render children()}</span>{:else if label}<span>{label}</span>{/if}
</label>

<style>
  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: var(--nf-space-2);
    cursor: pointer;
  }
  input {
    appearance: none;
    display: grid;
    place-content: center;
    width: 14px;
    height: 14px;
    margin: 0;
    border: 1px solid var(--nf-color-border-strong);
    border-radius: 2px;
    background: var(--nf-color-sunken);
    cursor: inherit;
  }
  input:checked {
    border-color: var(--nf-color-accent);
    background: var(--nf-color-accent);
  }
  input:checked::after {
    content: '';
    width: 7px;
    height: 4px;
    margin-top: -2px;
    border-left: 2px solid var(--nf-color-on-accent);
    border-bottom: 2px solid var(--nf-color-on-accent);
    rotate: -45deg;
  }
  .disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
