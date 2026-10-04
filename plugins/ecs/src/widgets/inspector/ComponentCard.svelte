<script lang="ts">
  import type { CatalogItem, Element } from '@nanoforge-dev/editor-sdk';
  import {
    ColorPicker,
    IconButton,
    Menu,
    type MenuEntry,
    NumberInput,
    Tooltip,
  } from '@nanoforge-dev/editor-sdk/ui';

  import type { FieldEditor } from '../../extension/field-editor.extension-point';
  import type { ParamPreset } from '../../extension/param-preset.extension-point';
  import { BUILT_IN_PRESETS, type LayoutRow, buildLayout } from '../../layout/param-layout';
  import type { ArgValue, ComponentUse, ImportNeed } from '../../model/ecs-model.type';
  import { currentValue, defaultArg, hexToRgb, rgbToHex } from '../../model/arg-values';
  import ParamField from './ParamField.svelte';

  interface Props {
    component: ComponentUse;
    item: CatalogItem | undefined;
    /** Ids (`param:x`, `group:Debug`) the user chose to show although hidden. */
    shown: ReadonlySet<string>;
    first: boolean;
    last: boolean;
    editors?: readonly FieldEditor[];
    presets?: readonly ParamPreset[];
    onargs: (args: Record<number, ArgValue>, fill: ArgValue[], imports?: ImportNeed[]) => void;
    onshow: (id: string, visible: boolean) => void;
    onmove: (offset: -1 | 1) => void;
    onremove: () => void;
    onopen: () => void;
  }

  const {
    component,
    item,
    shown,
    first,
    last,
    editors = [],
    presets = [],
    onargs,
    onshow,
    onmove,
    onremove,
    onopen,
  }: Props = $props();

  /** Params from the catalog; without it, one code field per argument. */
  const params = $derived<readonly Element[]>(
    item?.meta.params ??
      component.args.map((_, index) => ({
        type: 'unknown',
        name: `argument ${index + 1}`,
        tsType: '',
      })),
  );
  const layout = $derived(
    buildLayout(params, item?.meta.groups ?? [], shown, [...presets, ...BUILT_IN_PRESETS]),
  );
  const title = $derived(component.className ?? component.code);
  let collapsed = $state(new Set<string>());
  let ratioLocked = $state(false);

  const fill = () => params.map(defaultArg);
  const set = (index: number, value: ArgValue, imports?: ImportNeed[]) =>
    onargs({ [index]: value }, fill(), imports);
  const numberOf = (index: number) => {
    const value = currentValue(params[index]!, component.args[index]);
    return typeof value === 'number' ? value : 0;
  };

  const menu = $derived.by((): MenuEntry[] => {
    const hiddenShown = [...shown].filter((id) =>
      id.startsWith('group:')
        ? item?.meta.groups.some((group) => `group:${group.name}` === id && group.hidden)
        : params.some((param) => `param:${param.name}` === id && param.layout?.hidden),
    );
    return [
      { kind: 'item', id: 'up', label: 'Move up', disabled: first, onSelect: () => onmove(-1) },
      { kind: 'item', id: 'down', label: 'Move down', disabled: last, onSelect: () => onmove(1) },
      { kind: 'item', id: 'open', label: 'Open source', disabled: !item, onSelect: onopen },
      ...(hiddenShown.length
        ? [
            { kind: 'separator' as const },
            ...hiddenShown.map((id) => ({
              kind: 'item' as const,
              id: `hide-${id}`,
              label: `Hide ${id.slice(id.indexOf(':') + 1)} again`,
              onSelect: () => onshow(id, false),
            })),
          ]
        : []),
      { kind: 'separator' },
      { kind: 'item', id: 'remove', label: 'Remove component', onSelect: onremove },
    ];
  });

  const toggle = (name: string) => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- replaced, not mutated in place
    const next = new Set(collapsed);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    collapsed = next;
  };
</script>

{#snippet info(text: string | undefined, label: string)}
  {#if text}
    <Tooltip {text}>
      {#snippet children({ props })}
        <span {...props} class="info" role="img" aria-label="About {label}">ⓘ</span>
      {/snippet}
    </Tooltip>
  {/if}
{/snippet}

{#snippet row(entry: LayoutRow)}
  {#if entry.hidden}

  {:else if entry.kind === 'param'}
    <ParamField
      element={entry.element}
      arg={component.args[entry.index]}
      label={entry.label}
      color={entry.color}
      preset={entry.preset}
      {editors}
      disabled={!component.editable}
      onchange={(value, imports) => set(entry.index, value, imports)}
    />
  {:else if (entry.preset as ParamPreset).component}
    {@const Editor = (entry.preset as ParamPreset).component!}
    <div class="preset" role="group" aria-label={entry.label}>
      <span class="label">{entry.label}</span>
      <Editor
        row={entry}
        values={entry.slots.map((slot) => currentValue(slot.element, component.args[slot.index]))}
        disabled={!component.editable}
        onchange={(args) => onargs(args, fill())}
      />
    </div>
  {:else if entry.preset.id === 'color'}
    {@const [r, g, b] = entry.slots.map((slot) => numberOf(slot.index))}
    <div class="preset" role="group" aria-label={entry.label}>
      <span class="label">{entry.label}</span>
      <ColorPicker
        label={entry.label}
        value={rgbToHex(r ?? 0, g ?? 0, b ?? 0)}
        disabled={!component.editable}
        onchange={(next, final) => {
          if (!final) return;
          const rgb = hexToRgb(next);
          const args: Record<number, ArgValue> = {};
          entry.slots.forEach((slot, i) => {
            if (i < 3) args[slot.index] = { value: rgb[i] };
          });
          onargs(args, fill());
        }}
      />
    </div>
  {:else}
    <div class="preset" role="group" aria-label={entry.label}>
      <span class="label">{entry.label}</span>
      <span class="inputs">
        {#each entry.slots as slot (slot.slot)}
          <NumberInput
            prefix={slot.slot === 'width'
              ? 'W'
              : slot.slot === 'height'
                ? 'H'
                : slot.slot.toUpperCase()}
            label="{entry.label} {slot.slot}"
            value={numberOf(slot.index)}
            disabled={!component.editable}
            onchange={(next, final) => {
              if (!final) return;
              const args: Record<number, ArgValue> = { [slot.index]: { value: next } };
              if (entry.preset.id === 'size' && ratioLocked) {
                const other = entry.slots.find((candidate) => candidate !== slot);
                const before = numberOf(slot.index);
                if (other && before)
                  args[other.index] = { value: (numberOf(other.index) * next) / before };
              }
              onargs(args, fill());
            }}
          />
        {/each}
        {#if entry.preset.id === 'size'}
          <IconButton
            icon="lock"
            label={ratioLocked ? 'Unlock the ratio' : 'Keep the ratio'}
            pressed={ratioLocked}
            onclick={() => (ratioLocked = !ratioLocked)}
          />
        {/if}
      </span>
    </div>
  {/if}
{/snippet}

<section class="card" aria-label={title}>
  <header>
    <span class="title">{title}</span>
    {@render info(item?.meta.description, title)}
    <span class="spacer"></span>
    {#if layout.hidden.length}
      <Menu
        items={layout.hidden.map((entry) => ({
          kind: 'item' as const,
          id: entry.id,
          label: entry.label,
          onSelect: () => onshow(entry.id, true),
        }))}
      >
        {#snippet trigger({ props })}
          <button {...props} class="show-hidden">Show hidden ({layout.hidden.length})</button>
        {/snippet}
      </Menu>
    {/if}
    <Menu items={menu}>
      {#snippet trigger({ props })}
        <IconButton {...props} icon="ellipsis" label="{title} actions" />
      {/snippet}
    </Menu>
  </header>

  {#if !component.editable}
    <p class="code-only">{component.code}</p>
  {:else}
    <div class="body">
      {#each layout.blocks as block, index (index)}
        {#if block.kind === 'group'}
          {#if !block.hidden}
            <div class="group">
              <button
                class="group-title"
                style:color={block.group.color}
                aria-expanded={!collapsed.has(block.group.name)}
                onclick={() => toggle(block.group.name)}
              >
                {collapsed.has(block.group.name) ? '▸' : '▾'}
                {block.group.name}
              </button>
              {@render info(block.group.description, block.group.name)}
              {#if !collapsed.has(block.group.name)}
                <div class="group-body">
                  {#each block.rows as entry, rowIndex (rowIndex)}
                    {@render row(entry)}
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {:else}
          {@render row(block)}
        {/if}
      {/each}
      {#each layout.warnings as warning (warning)}
        <p class="warning">{warning}</p>
      {/each}
    </div>
  {/if}
</section>

<style>
  .card {
    border-bottom: 1px solid var(--nf-color-border);
  }
  header {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
    padding: var(--nf-space-1) var(--nf-space-2);
    background: transparent;
  }
  .title {
    font-weight: 600;
  }
  .spacer {
    flex: 1;
  }
  .info {
    cursor: help;
    opacity: 0.7;
  }
  .show-hidden {
    border: 0;
    background: none;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
    cursor: pointer;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--nf-space-1) var(--nf-space-2) var(--nf-space-2);
  }
  .group-title {
    border: 0;
    background: none;
    color: inherit;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 0;
  }
  .group-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: var(--nf-space-2);
  }
  .preset {
    display: grid;
    grid-template-columns: minmax(80px, 38%) 1fr;
    gap: var(--nf-space-2);
    align-items: center;
  }
  .preset .label {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .inputs {
    display: flex;
    gap: var(--nf-space-1);
    min-width: 0;
  }
  .code-only {
    margin: 0;
    padding: var(--nf-space-1) var(--nf-space-2);
    font-family: var(--nf-font-mono);
    font-size: var(--nf-font-size-sm);
    white-space: pre-wrap;
  }
  .warning {
    margin: var(--nf-space-1) 0 0;
    color: var(--nf-color-warning, orange);
    font-size: var(--nf-font-size-sm);
  }
</style>
