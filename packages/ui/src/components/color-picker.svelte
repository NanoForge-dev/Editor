<script lang="ts">
  interface Props {
    /** `#rrggbb`. */
    value: string;
    onchange?: (value: string, final: boolean) => void;
    label?: string;
    disabled?: boolean;
  }

  const { value, onchange, label = 'Color', disabled = false }: Props = $props();
  let text = $state('');
  let editing = $state(false);

  $effect(() => {
    if (!editing) text = value;
  });

  const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const normalize = (input: string) => {
    const match = HEX.exec(input.trim());
    if (!match) return undefined;
    const hex = match[1]!.length === 3 ? [...match[1]!].map((c) => c + c).join('') : match[1]!;
    return `#${hex.toLowerCase()}`;
  };

  const commitText = () => {
    editing = false;
    const color = normalize(text);
    if (color) onchange?.(color, true);
    else text = value;
  };
</script>

<div class="color" class:disabled>
  <label class="swatch" style:background={value} title={label}>
    <input
      type="color"
      aria-label="{label} picker"
      {value}
      {disabled}
      oninput={(event) => onchange?.(event.currentTarget.value, false)}
      onchange={(event) => onchange?.(event.currentTarget.value, true)}
    />
  </label>
  <input
    class="hex"
    type="text"
    aria-label={label}
    spellcheck="false"
    {disabled}
    bind:value={text}
    onfocus={() => (editing = true)}
    onblur={commitText}
    onkeydown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
  />
</div>

<style>
  .color {
    display: flex;
    gap: var(--nf-space-1);
    height: var(--nf-control-height);
  }
  .swatch {
    position: relative;
    width: var(--nf-control-height);
    flex: none;
    border: 1px solid var(--nf-color-border-strong);
    border-radius: var(--nf-radius-control);
    cursor: pointer;
  }
  .swatch input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .hex {
    flex: 1;
    min-width: 0;
    padding: 0 var(--nf-space-2);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-sunken);
    font-family: var(--nf-font-code);
    font-size: var(--nf-font-size-sm);
    outline: none;
  }
  .hex:focus {
    border-color: var(--nf-color-focus);
  }
  .disabled {
    opacity: 0.5;
  }
</style>
