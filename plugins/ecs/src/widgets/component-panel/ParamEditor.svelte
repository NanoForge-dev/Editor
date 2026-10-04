<script lang="ts">
  import type { Element, ParamGroup } from '@nanoforge-dev/editor-sdk';
  import { Button, ColorPicker, Input, Select, Switch } from '@nanoforge-dev/editor-sdk/ui';

  import { BUILT_IN_PRESETS } from '../../layout/param-layout';
  import { hexColor } from '../../model/arg-values';
  import type { ParamDocs } from '../../model/item-docs.type';
  import { freeSlots } from './component-docs';

  interface Props {
    element: Element;
    /** Every param of the component: slots are shared within a group. */
    params: readonly Element[];
    groups: readonly ParamGroup[];
    readonly: boolean;
    onchange: (change: Partial<ParamDocs>, label: string) => void;
    /** Puts the param in a group of its own. */
    onnewgroup: () => void;
    onpreset: (presetId: string | undefined) => void;
  }

  const { element, params, groups, readonly, onchange, onnewgroup, onpreset }: Props = $props();

  const NONE = '__none__';
  const NEW_GROUP = '__new__';
  const presetIds = [...new Set(BUILT_IN_PRESETS.map((preset) => preset.id))];
  const presetId = $derived(element.layout?.preset?.id ?? NONE);
</script>

<div class="param" role="group" aria-label="Param {element.name}">
  <strong>{element.name}</strong> <span class="muted">{element.type}</span>
  <label>
    <span>Name</span>
    <Input
      aria-label="Name of {element.name}"
      placeholder={element.name}
      value={element.layout?.label ?? ''}
      disabled={readonly}
      onchange={(event) =>
        onchange(
          { label: (event.currentTarget as HTMLInputElement).value.trim() || undefined },
          `Name ${element.name}`,
        )}
    />
  </label>
  <label>
    <span>Description</span>
    <Input
      aria-label="Description of {element.name}"
      value={element.description ?? ''}
      disabled={readonly}
      onchange={(event) =>
        onchange(
          { description: (event.currentTarget as HTMLInputElement).value.trim() },
          `Describe ${element.name}`,
        )}
    />
  </label>
  <div class="row">
    <span>Group</span>
    <Select
      label="Group of {element.name}"
      value={element.layout?.group ?? NONE}
      items={[
        { value: NONE, label: 'None' },
        ...groups.map((group) => ({ value: group.name, label: group.name })),
        { value: NEW_GROUP, label: 'New group…' },
      ]}
      disabled={readonly}
      onchange={(value) => {
        if (value === NEW_GROUP) onnewgroup();
        else onchange({ group: value === NONE ? undefined : value }, `Group ${element.name}`);
      }}
    />
  </div>
  <div class="row">
    <span>Preset</span>
    <Select
      label="Preset of {element.name}"
      value={presetId}
      items={[{ value: NONE, label: 'None' }, ...presetIds.map((id) => ({ value: id, label: id }))]}
      disabled={readonly}
      onchange={(value) => onpreset(value === NONE ? undefined : value)}
    />
    {#if element.layout?.preset?.slot}
      {@const slots = [
        element.layout.preset.slot,
        ...freeSlots(params, element, presetId).filter(
          (slot) => slot !== element.layout?.preset?.slot,
        ),
      ]}
      <Select
        label="Slot of {element.name}"
        value={element.layout.preset.slot}
        items={slots.map((slot) => ({ value: slot, label: slot }))}
        disabled={readonly}
        onchange={(slot) =>
          onchange({ preset: `${presetId}.${slot}` }, `Set the slot of ${element.name}`)}
      />
    {/if}
  </div>
  <div class="row">
    <span>Color</span>
    <ColorPicker
      label="Color of {element.name}"
      value={hexColor(element.layout?.color) ?? '#ffffff'}
      disabled={readonly}
      onchange={(value, final) => final && onchange({ color: value }, `Color ${element.name}`)}
    />
    {#if element.layout?.color}
      <Button
        size="sm"
        variant="ghost"
        disabled={readonly}
        onclick={() => onchange({ color: undefined }, `Remove the color of ${element.name}`)}
        >None</Button
      >
    {/if}
    <Switch
      label="Hide {element.name}"
      checked={element.layout?.hidden ?? false}
      disabled={readonly}
      onchange={(hidden) => onchange({ hidden: hidden || undefined }, `Hide ${element.name}`)}
    />
  </div>
</div>

<style>
  .param {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--nf-space-1) 0;
    border-top: 1px solid var(--nf-color-border);
  }
  label,
  .row {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
  }
  label > span,
  .row > span {
    width: 80px;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .muted {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
</style>
