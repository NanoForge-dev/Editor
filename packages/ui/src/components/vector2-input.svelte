<script lang="ts">
  import NumberInput from './number-input.svelte';

  interface Props {
    value: { x: number; y: number };
    onchange?: (value: { x: number; y: number }, final: boolean) => void;
    label?: string;
    step?: number;
    precision?: number;
    disabled?: boolean;
  }

  const { value, onchange, label = 'Vector', step, precision, disabled }: Props = $props();
</script>

<div class="vector" role="group" aria-label={label}>
  <NumberInput
    prefix="X"
    label="{label} X"
    value={value.x}
    {step}
    {precision}
    {disabled}
    onchange={(x, final) => onchange?.({ ...value, x }, final)}
  />
  <NumberInput
    prefix="Y"
    label="{label} Y"
    value={value.y}
    {step}
    {precision}
    {disabled}
    onchange={(y, final) => onchange?.({ ...value, y }, final)}
  />
</div>

<style>
  .vector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--nf-space-1);
  }
</style>
