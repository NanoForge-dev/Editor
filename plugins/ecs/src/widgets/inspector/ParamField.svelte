<script lang="ts">
  import type { Element } from '@nanoforge-dev/editor-sdk';
  import {
    ColorPicker,
    Input,
    NumberInput,
    Select,
    Switch,
    Tooltip,
  } from '@nanoforge-dev/editor-sdk/ui';

  import { type FieldEditor, fieldEditorFor } from '../../extension/field-editor.extension-point';
  import type { ArgModel, ArgValue, ImportNeed } from '../../model/ecs-model.type';
  import { currentValue, enumMemberArg, hexColor } from '../../model/arg-values';

  interface Props {
    element: Element;
    arg: ArgModel | undefined;
    label: string;
    color?: string;
    /** A one-param preset (`color`). */
    preset?: string;
    disabled?: boolean;
    /** Fields contributed by other plugins (`ecs.fieldEditors`). */
    editors?: readonly FieldEditor[];
    onchange: (value: ArgValue, imports?: ImportNeed[]) => void;
  }

  const {
    element,
    arg,
    label,
    color,
    preset,
    disabled = false,
    editors = [],
    onchange,
  }: Props = $props();
  const contributed = $derived(fieldEditorFor(editors, element));

  const value = $derived(currentValue(element, arg));
  /** The argument's code, when the field edits code (refs, objects, non-literal args). */
  const code = $derived(arg?.code ?? ('defaultCode' in element ? (element.defaultCode ?? '') : ''));
  const members = $derived('enumMembers' in element ? (element.enumMembers ?? []) : []);
  /** The enum member of the argument: by value, or by its code (`InputEnum.ArrowUp`). */
  const member = $derived(
    members.find((candidate) => candidate.value === value)?.name ??
      members.find((candidate) => arg?.code.trim().endsWith(`.${candidate.name}`))?.name ??
      '',
  );
  const literalOnly = $derived(arg !== undefined && arg.value === undefined);
  let text = $derived(typeof value === 'string' ? value : code);
</script>

<div class="field">
  <span class="label" style:color>
    {label}
    {#if element.description}
      <Tooltip text={element.description}>
        {#snippet children({ props })}
          <span {...props} class="info" role="img" aria-label="About {label}">ⓘ</span>
        {/snippet}
      </Tooltip>
    {/if}
  </span>
  <span class="control">
    {#if contributed}
      {@const Editor = contributed.component}
      <Editor {element} {arg} {label} {disabled} {onchange} />
    {:else if members.length && 'enumRef' in element && element.enumRef}
      {@const enumRef = element.enumRef}
      <Select
        {label}
        value={member}
        items={members.map((candidate) => ({ value: candidate.name, label: candidate.name }))}
        {disabled}
        onchange={(name) => {
          const next = enumMemberArg(enumRef, name);
          onchange(next.value, next.imports);
        }}
      />
    {:else if literalOnly || element.type === 'ref' || element.type === 'unknown' || element.type === 'object' || element.type === 'array'}
      <Input
        class="code"
        aria-label="{label} (code)"
        title={code}
        value={code}
        {disabled}
        onchange={(event) => onchange({ code: (event.currentTarget as HTMLInputElement).value })}
      />
    {:else if element.type === 'number'}
      <NumberInput
        {label}
        value={typeof value === 'number' ? value : 0}
        {disabled}
        onchange={(next, final) => final && onchange({ value: next })}
      />
    {:else if element.type === 'boolean'}
      <Switch
        {label}
        checked={value === true}
        {disabled}
        onchange={(next) => onchange({ value: next })}
      />
    {:else if element.type === 'string' && element.enum?.length}
      <Select
        {label}
        value={typeof value === 'string' ? value : ''}
        items={element.enum.map((option) => ({ value: option, label: option }))}
        {disabled}
        onchange={(next) => onchange({ value: next })}
      />
    {:else if preset === 'color' && (hexColor(value) || value === undefined)}
      <ColorPicker
        {label}
        value={hexColor(value) ?? '#ffffff'}
        {disabled}
        onchange={(next, final) => final && onchange({ value: next })}
      />
    {:else}
      <Input
        aria-label={label}
        bind:value={text}
        placeholder={element.type === 'asset' ? 'Path of an asset' : ''}
        {disabled}
        onchange={() => onchange({ value: text })}
      />
    {/if}
  </span>
</div>

<style>
  .field {
    display: grid;
    grid-template-columns: minmax(80px, 38%) 1fr;
    gap: var(--nf-space-2);
    align-items: center;
    min-height: 26px;
  }
  .label {
    overflow: hidden;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .info {
    margin-left: 2px;
    cursor: help;
    opacity: 0.7;
  }
  .control {
    min-width: 0;
  }
  .control :global(input) {
    width: 100%;
  }
  .control :global(.code) {
    font-family: var(--nf-font-mono);
  }
</style>
