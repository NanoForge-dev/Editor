<script lang="ts">
  import Checkbox from './checkbox.svelte';
  import ColorPicker from './color-picker.svelte';
  import Input from './input.svelte';
  import NumberInput from './number-input.svelte';
  import Select from './select.svelte';
  import Vector2Input from './vector2-input.svelte';
  import type { PropertyField } from './property-field.type';

  interface Props {
    fields: readonly PropertyField[];
    values: Readonly<Record<string, unknown>>;
    /** `final` is false while dragging/scrubbing (live preview), true once committed. */
    onchange: (key: string, value: unknown, final: boolean) => void;
    label?: string;
  }

  const { fields, values, onchange, label = 'Properties' }: Props = $props();

  const vector = (value: unknown) => {
    const v = (value ?? {}) as { x?: number; y?: number };
    return { x: Number(v.x ?? 0), y: Number(v.y ?? 0) };
  };
  const text = (value: unknown) => (value === undefined || value === null ? '' : String(value));
</script>

<div class="grid" role="group" aria-label={label}>
  {#each fields as field (field.key)}
    <label class="name" for="nf-prop-{field.key}" title={field.description}>{field.label}</label>
    <div class="editor" id="nf-prop-{field.key}">
      {#if field.type === 'number'}
        <NumberInput
          label={field.label}
          value={Number(values[field.key] ?? 0)}
          step={field.step}
          min={field.min}
          max={field.max}
          precision={field.precision}
          disabled={field.readonly}
          onchange={(value, final) => onchange(field.key, value, final)}
        />
      {:else if field.type === 'boolean'}
        <Checkbox
          label={field.label}
          checked={Boolean(values[field.key])}
          disabled={field.readonly}
          onchange={(checked) => onchange(field.key, checked, true)}
        />
      {:else if field.type === 'color'}
        <ColorPicker
          label={field.label}
          value={text(values[field.key]) || '#000000'}
          disabled={field.readonly}
          onchange={(value, final) => onchange(field.key, value, final)}
        />
      {:else if field.type === 'vector2'}
        <Vector2Input
          label={field.label}
          value={vector(values[field.key])}
          step={field.step}
          disabled={field.readonly}
          onchange={(value, final) => onchange(field.key, value, final)}
        />
      {:else if field.type === 'enum'}
        <Select
          label={field.label}
          value={text(values[field.key])}
          items={field.options}
          disabled={field.readonly}
          onchange={(value) => onchange(field.key, value, true)}
        />
      {:else if field.type === 'json'}
        <Input
          aria-label={field.label}
          value={JSON.stringify(values[field.key] ?? null)}
          readonly={field.readonly}
          onchange={(event) => {
            try {
              onchange(field.key, JSON.parse(event.currentTarget.value), true);
            } catch {
              event.currentTarget.value = JSON.stringify(values[field.key] ?? null);
            }
          }}
        />
      {:else}
        <Input
          aria-label={field.label}
          value={text(values[field.key])}
          placeholder={field.placeholder}
          readonly={field.readonly}
          onchange={(event) => onchange(field.key, event.currentTarget.value, true)}
        />
      {/if}
    </div>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(90px, 38%) 1fr;
    gap: var(--nf-space-1) var(--nf-space-2);
    align-items: center;
    padding: var(--nf-space-2);
  }
  .name {
    overflow: hidden;
    color: var(--nf-color-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .editor {
    min-width: 0;
  }
</style>
