<script lang="ts">
  import {
    EditorServices,
    type ServiceAccessor,
    SettingsServiceToken,
    type WritableScope,
  } from '@nanoforge-dev/editor-sdk';
  import {
    Button,
    Checkbox,
    DEFAULT_KEYMAP_PRESET,
    type EditorAction,
    EmptyState,
    IconButton,
    Input,
    KEYBINDINGS,
    KEYMAP_PRESETS,
    KeybindingServiceToken,
    type KeymapLayers,
    type KeymapOverride,
    type ResolvedKeybinding,
    Select,
    type SettingsPageApi,
    actionId,
    formatKeybinding,
    listActions,
    resetAction,
    resolveLayers,
    setShortcut,
  } from '@nanoforge-dev/editor-sdk/ui';

  import type { RecordedShortcut } from './RecordDialog.svelte';
  import { OVERRIDES, PRESET } from './keymap.const';
  import {
    type KeymapRow,
    conflictsOf,
    filterRows,
    keymapRows,
    strokesOf,
    userConflicts,
  } from './keymap-rows';
  import { closeRecordDialog, openRecordDialog } from './open-record-dialog';

  type Scope = Extract<WritableScope, 'account' | 'machine'>;

  const input: { services: ServiceAccessor; page: SettingsPageApi } = $props();
  // svelte-ignore state_referenced_locally
  const [services, page] = [input.services, input.page];
  const extensions = services.get(EditorServices.Extensions);
  const commands = services.get(EditorServices.Commands);
  const settings = services.get(SettingsServiceToken);
  const keybindings = services.tryGet(KeybindingServiceToken);
  const revision = page.revision;

  const SCOPES = (
    [
      { value: 'account', label: 'Account' },
      { value: 'machine', label: 'This machine' },
    ] as const
  ).filter((scope) => settings.hasStore(scope.value));
  let scope = $state<Scope>(SCOPES[0]?.value ?? 'machine');
  let query = $state('');
  let onlyChanged = $state(false);
  let onlyConflicts = $state(false);

  const listOf = (target: Scope): readonly KeymapOverride[] =>
    (page.scopeValue(OVERRIDES, target) as readonly KeymapOverride[] | undefined) ?? [];
  const presets = extensions.getValues(KEYMAP_PRESETS);
  const presetItems = [
    { value: DEFAULT_KEYMAP_PRESET, label: 'NanoForge' },
    ...presets.map((preset) => ({ value: preset.id, label: preset.title })),
  ];
  const actions = listActions({ commands, extensions });

  const presetId = $derived.by(() => {
    void $revision;
    return (page.value(PRESET) as string | undefined) ?? DEFAULT_KEYMAP_PRESET;
  });
  const preset = $derived(presets.find((candidate) => candidate.id === presetId));
  /** The keymap with the pending changes: the edited scope's list between the others. */
  const layers = $derived.by((): KeymapLayers => {
    void $revision;
    const account = listOf('account');
    const machine = listOf('machine');
    return {
      defaults: extensions.getValues(KEYBINDINGS),
      preset: preset?.bindings ?? [],
      before: scope === 'machine' ? account : [],
      own: scope === 'machine' ? machine : account,
      after: scope === 'machine' ? [] : machine,
    };
  });
  const bindings = $derived(resolveLayers(layers));
  /** Shortcuts in a conflict the user's own changes are part of. */
  const conflicting = $derived(userConflicts(bindings));
  const pending = $derived.by(() => {
    void $revision;
    return page.isPending(OVERRIDES);
  });

  const rows = $derived(keymapRows(actions, layers, bindings, conflicting));
  const shown = $derived(filterRows(rows, { query, onlyChanged, onlyConflicts }));

  const sourceOf = (binding: ResolvedKeybinding) =>
    binding.source === 'user'
      ? 'You'
      : binding.source === 'preset'
        ? (preset?.title ?? 'Preset')
        : 'Default';

  const write = (own: readonly KeymapOverride[]) => page.set(OVERRIDES, own, scope);
  const refOf = (binding: Pick<ResolvedKeybinding, 'command' | 'args' | 'key'>) => ({
    command: binding.command,
    args: binding.args,
    key: binding.key,
  });

  const remove = (binding: ResolvedKeybinding) =>
    write(setShortcut(layers, refOf(binding), undefined));
  const reset = (action: EditorAction) =>
    write(resetAction(layers.own, action.command, action.args));

  const labelOf = (binding: ResolvedKeybinding) => {
    const id = actionId(binding.command, binding.args);
    return rows.find((row) => row.action.id === id)?.label ?? id;
  };

  $effect(() => closeRecordDialog);

  const record = (row: KeymapRow, editing?: ResolvedKeybinding) => {
    const save = ({ key, when, replace }: RecordedShortcut) => {
      let own = [...layers.own];
      const apply = (
        ref: Parameters<typeof setShortcut>[1],
        state: Parameters<typeof setShortcut>[2],
      ) => {
        own = setShortcut({ ...layers, own }, ref, state);
      };
      if (editing && strokesOf(editing.key)?.join(' ') !== strokesOf(key)?.join(' '))
        apply(refOf(editing), undefined);
      if (replace) {
        for (const other of conflictsOf(bindings, row.action, key, when, editing))
          apply(refOf(other), undefined);
      }
      apply({ command: row.action.command, args: row.action.args, key }, { when });
      write(own);
      closeRecordDialog();
    };
    openRecordDialog({
      action: row.label,
      ...(editing && { initial: { key: editing.key, when: editing.when } }),
      conflictsFor: (key: string, when: string | undefined) =>
        conflictsOf(bindings, row.action, key, when, editing).map((binding) => ({
          action: labelOf(binding),
          key: binding.key,
        })),
      keybindings,
      onsave: save,
      oncancel: closeRecordDialog,
    });
  };
</script>

<div class="keymap">
  <div class="top">
    <label>
      <span>Preset</span>
      <Select
        label="Preset"
        value={presetId}
        items={presetItems}
        onchange={(id) => page.set(PRESET, id, scope)}
      />
    </label>
    {#if SCOPES.length > 1}
      <label title={pending ? 'Apply your changes before switching' : undefined}>
        <span>Save changes to</span>
        <Select
          label="Save changes to"
          value={scope}
          items={SCOPES}
          disabled={pending}
          onchange={(value) => (scope = value)}
        />
      </label>
    {/if}
  </div>
  <div class="filters">
    <Input bind:value={query} placeholder="Search shortcuts" aria-label="Search shortcuts" />
    <Checkbox bind:checked={onlyChanged} label="Changed" />
    <Checkbox bind:checked={onlyConflicts} label="Conflicts" />
  </div>
  <ul class="actions" aria-label="Keyboard shortcuts">
    {#each shown as row (row.action.id)}
      <li aria-label={row.label} class:conflict={row.conflict}>
        <div class="name">
          <span>{row.label}</span>
          <code>{row.action.command}</code>
        </div>
        <div class="shortcuts">
          {#each row.bindings as binding, index (index)}
            <span class="shortcut" class:conflict={conflicting.has(binding)}>
              <kbd>{formatKeybinding(binding.key)}</kbd>
              {#if binding.when}<span class="when" title={binding.when}>when {binding.when}</span
                >{/if}
              <span class="source">{sourceOf(binding)}</span>
              {#if conflicting.has(binding)}<span class="mark">Conflict</span>{/if}
              <IconButton
                icon="pencil"
                size={13}
                label={`Edit shortcut ${formatKeybinding(binding.key)}`}
                onclick={() => record(row, binding)}
              />
              <IconButton
                icon="trash-2"
                size={13}
                label={`Remove shortcut ${formatKeybinding(binding.key)}`}
                onclick={() => remove(binding)}
              />
            </span>
          {/each}
          <Button size="sm" variant="ghost" icon="plus" onclick={() => record(row)}
            >Add shortcut</Button
          >
          {#if row.changed}
            <Button size="sm" variant="ghost" icon="rotate-ccw" onclick={() => reset(row.action)}
              >Reset</Button
            >
          {/if}
        </div>
      </li>
    {:else}
      <EmptyState icon="keyboard" title="No shortcut matches" />
    {/each}
  </ul>
</div>

<style>
  .keymap {
    display: flex;
    flex-direction: column;
    gap: var(--nf-space-2);
    height: 100%;
    min-height: 0;
  }
  .top,
  .filters {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: var(--nf-space-3);
    align-items: center;
  }
  .top label {
    display: inline-flex;
    gap: var(--nf-space-2);
    align-items: center;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .filters :global(input[type='text']),
  .filters :global(input:not([type])) {
    flex: 1;
    min-width: 160px;
  }
  .actions {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow: auto;
    list-style: none;
  }
  li {
    display: grid;
    grid-template-columns: minmax(180px, 2fr) 3fr;
    gap: var(--nf-space-3);
    align-items: center;
    padding: var(--nf-space-1) var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  li:hover {
    background: var(--nf-color-hover);
  }
  .name {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name code {
    overflow: hidden;
    color: var(--nf-color-text-faint);
    font-family: var(--nf-font-code);
    font-size: var(--nf-font-size-xs, 11px);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .shortcuts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nf-space-2);
    align-items: center;
  }
  .shortcut {
    display: inline-flex;
    gap: var(--nf-space-1);
    align-items: center;
    padding-left: var(--nf-space-2);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-control);
    font-size: var(--nf-font-size-sm);
  }
  .shortcut.conflict {
    border-color: var(--nf-color-warning);
  }
  kbd {
    font-family: var(--nf-font-code);
  }
  .when {
    max-width: 22ch;
    overflow: hidden;
    color: var(--nf-color-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .source {
    color: var(--nf-color-text-faint);
  }
  .mark {
    color: var(--nf-color-warning);
  }
</style>
