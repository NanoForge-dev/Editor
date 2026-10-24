<script lang="ts">
  interface Props {
    checked?: boolean;
    disabled?: boolean;
    label: string;
    onchange?: (checked: boolean) => void;
  }

  let { checked = $bindable(false), disabled = false, label, onchange }: Props = $props();

  const toggle = () => {
    checked = !checked;
    onchange?.(checked);
  };
</script>

<button
  type="button"
  role="switch"
  class="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  onclick={toggle}
>
  <span class="thumb"></span>
</button>

<style>
  .switch {
    position: relative;
    width: 28px;
    height: 16px;
    padding: 0;
    border: 1px solid var(--nf-color-border-strong);
    border-radius: 8px;
    background: var(--nf-color-sunken);
    cursor: pointer;
    transition: background-color var(--nf-motion-fast);
  }
  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--nf-color-text-muted);
    transition: translate var(--nf-motion-fast);
  }
  [aria-checked='true'] {
    border-color: var(--nf-color-accent);
    background: var(--nf-color-accent);
  }
  [aria-checked='true'] .thumb {
    translate: 12px 0;
    background: var(--nf-color-on-accent);
  }
  .switch:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
