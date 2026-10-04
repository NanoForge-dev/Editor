<script lang="ts">
  interface Props {
    value: number;
    /** Called while typing/scrubbing (`final: false`) and once committed (`final: true`). */
    onchange?: (value: number, final: boolean) => void;
    label?: string;
    step?: number;
    min?: number;
    max?: number;
    /** Decimals shown and kept. */
    precision?: number;
    disabled?: boolean;
    /** Short prefix shown inside the field (e.g. `X`); dragging it scrubs the value. */
    prefix?: string;
  }

  const {
    value,
    onchange,
    label,
    step = 1,
    min = -Infinity,
    max = Infinity,
    precision = 3,
    disabled = false,
    prefix,
  }: Props = $props();

  let text = $state('');
  let editing = $state(false);
  let scrubbing = $state(false);

  const round = (n: number) => Number(Math.min(max, Math.max(min, n)).toFixed(precision));
  const format = (n: number) => String(round(n));

  $effect(() => {
    if (!editing) text = format(value);
  });

  /** Marked while typing: a text that isn't a number is dropped when the field is left. */
  const invalid = $derived(
    editing && text.trim() !== '' && Number.isNaN(Number(text.replace(',', '.'))),
  );

  const commit = () => {
    editing = false;
    const parsed = Number(text.replace(',', '.'));
    if (text.trim() === '' || Number.isNaN(parsed)) {
      text = format(value);
      return;
    }
    onchange?.(round(parsed), true);
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur();
    else if (event.key === 'Escape') {
      editing = false;
      text = format(value);
      (event.currentTarget as HTMLInputElement).blur();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const factor = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
      onchange?.(round(value + (event.key === 'ArrowUp' ? step : -step) * factor), true);
    }
  };

  /** Drag horizontally on the prefix to change the value (Shift ×10, Alt ×0.1). */
  const scrub = (event: PointerEvent) => {
    if (disabled || event.button !== 0) return;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const start = value;
    let startX = event.clientX;
    let moved = false;
    let current = start;
    scrubbing = true;
    const move = (e: PointerEvent) => {
      const factor = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      if (!moved && Math.abs(e.clientX - startX) < 3) return;
      if (!moved) startX = e.clientX;
      moved = true;
      current = round(start + ((e.clientX - startX) / 4) * step * factor);
      onchange?.(current, false);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      scrubbing = false;
      if (moved) onchange?.(current, true);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };
</script>

<div class="number" class:disabled class:scrubbing class:invalid>
  {#if prefix}
    <span class="prefix" onpointerdown={scrub} aria-hidden="true">{prefix}</span>
  {/if}
  <input
    type="text"
    inputmode="decimal"
    aria-label={label}
    aria-invalid={invalid || undefined}
    {disabled}
    bind:value={text}
    onfocus={() => (editing = true)}
    onblur={commit}
    {onkeydown}
  />
</div>

<style>
  .number {
    display: flex;
    align-items: stretch;
    min-width: 0;
    height: var(--nf-control-height);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-sunken);
  }
  .number:hover {
    border-color: var(--nf-color-border-strong);
  }
  .number:focus-within {
    border-color: var(--nf-color-focus);
  }
  .number.invalid,
  .number.invalid:focus-within {
    border-color: var(--nf-color-danger);
  }
  .prefix {
    display: grid;
    place-items: center;
    min-width: 18px;
    padding: 0 4px;
    border-right: 1px solid var(--nf-color-border);
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-xs);
    font-weight: 600;
    cursor: ew-resize;
    user-select: none;
    touch-action: none;
  }
  .scrubbing .prefix {
    color: var(--nf-color-accent);
  }
  input {
    flex: 1;
    min-width: 0;
    padding: 0 var(--nf-space-2);
    border: 0;
    background: transparent;
    outline: none;
    text-align: right;
  }
  .disabled {
    opacity: 0.5;
  }
</style>
