<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLInputAttributes, 'value'> {
    value?: string;
    invalid?: boolean;
    ref?: HTMLInputElement;
  }

  let { value = $bindable(''), invalid = false, ref = $bindable(), ...rest }: Props = $props();
</script>

<input
  class="input"
  class:invalid
  bind:value
  bind:this={ref}
  aria-invalid={invalid || undefined}
  {...rest}
/>

<style>
  .input {
    width: 100%;
    height: var(--nf-control-height);
    padding: 0 var(--nf-space-2);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-sunken);
    outline: none;
  }
  .input:hover {
    border-color: var(--nf-color-border-strong);
  }
  .input:focus {
    border-color: var(--nf-color-focus);
  }
  .input::placeholder {
    color: var(--nf-color-text-faint);
  }
  .invalid,
  .invalid:focus {
    border-color: var(--nf-color-danger);
  }
</style>
