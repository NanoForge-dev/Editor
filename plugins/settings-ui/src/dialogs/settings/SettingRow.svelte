<script lang="ts">
  import type {
    SettingDefinition,
    SettingScope,
    SettingsService,
    WritableScope,
  } from '@nanoforge-dev/editor-sdk';
  import {
    Button,
    IconButton,
    Input,
    Menu,
    type MenuEntry,
    NumberInput,
    Select,
    Switch,
  } from '@nanoforge-dev/editor-sdk/ui';

  import { SCOPE_LABELS } from '../../settings/setting-categories';
  import type { SettingsDraft } from '../../settings/settings-draft';
  import { controlOf } from '../../settings/setting-control';

  interface Props {
    definition: SettingDefinition;
    draft: SettingsDraft;
    settings: SettingsService;
    /** Bumped when settings or the draft change (the row reads plain values). */
    revision: number;
    /** Known values of a text setting (e.g. the installed themes): shown as a list. */
    choices?: { value: string; label: string }[] | undefined;
  }

  const { definition, draft, settings, revision, choices }: Props = $props();

  const control = $derived(controlOf(definition));
  const title = $derived(definition.title ?? definition.key);
  const inspection = $derived.by(() => {
    void revision;
    return settings.inspect(definition);
  });
  const value = $derived.by(() => {
    void revision;
    return draft.valueOf(definition);
  });
  const target = $derived.by(() => {
    void revision;
    return draft.scopeOf(definition);
  });
  const pending = $derived.by(() => {
    void revision;
    return draft.changes.get().has(definition.key);
  });
  const modified = $derived(inspection.effectiveScope !== 'default');
  let error = $state<string>();
  let inspecting = $state(false);
  let jsonText = $state('');
  $effect(() => {
    if (control.kind === 'json') jsonText = JSON.stringify(value, null, 2);
  });

  const update = (next: unknown) => {
    const parsed = definition.schema.safeParse(next);
    if (!parsed.success) {
      error = parsed.error.issues[0]?.message ?? 'Invalid value';
      return;
    }
    error = undefined;
    draft.set(definition, parsed.data);
  };

  const scopes = $derived(definition.scopes.filter((scope) => settings.hasStore(scope)));
  const scopeMenu = (): MenuEntry[] =>
    scopes.map((scope) => ({
      kind: 'item',
      id: scope,
      label: SCOPE_LABELS[scope],
      checked: scope === target,
      onSelect: () => draft.setScope(definition, scope),
    }));

  const format = (entry: unknown) =>
    entry === undefined ? '—' : typeof entry === 'string' ? entry : JSON.stringify(entry);
  const inspected = $derived(
    (['default', 'account', 'machine', 'project', 'projectLocal'] as const).filter(
      (scope: SettingScope) => scope === 'default' || definition.scopes.includes(scope),
    ),
  );
</script>

<div class="setting" class:pending data-key={definition.key}>
  <div class="head">
    <label class="title" for={`setting-${definition.key}`}>
      {title}
      {#if pending}<span class="marker pending" title="Not applied yet">●</span>
      {:else if modified}<span class="marker" title="Changed from the default">●</span>{/if}
    </label>
    <div class="scope">
      <Menu items={scopeMenu()} align="end">
        {#snippet trigger({ props })}
          <button {...props} type="button" class="scope-button" aria-label={`Scope of ${title}`}>
            {SCOPE_LABELS[target]}
          </button>
        {/snippet}
      </Menu>
      <IconButton
        icon="info"
        label={`Values of ${title} in each scope`}
        size={14}
        pressed={inspecting}
        onclick={() => (inspecting = !inspecting)}
      />
    </div>
  </div>
  {#if definition.description}<p class="description">{definition.description}</p>{/if}

  <div class="control">
    {#if control.kind === 'boolean'}
      <Switch checked={value === true} label={title} onchange={(checked) => update(checked)} />
    {:else if control.kind === 'enum'}
      <Select
        label={title}
        value={String(value)}
        items={control.options.map((option) => ({ value: option, label: option }))}
        onchange={(next) => update(next)}
      />
    {:else if control.kind === 'number'}
      <NumberInput
        label={title}
        value={Number(value)}
        {...control.min !== undefined && { min: control.min }}
        {...control.max !== undefined && { max: control.max }}
        precision={control.integer ? 0 : 2}
        onchange={(next, final) => final && update(next)}
      />
    {:else if control.kind === 'string' && choices?.length}
      <Select
        label={title}
        value={String(value ?? '')}
        items={choices.some((choice) => choice.value === value)
          ? choices
          : [...choices, { value: String(value ?? ''), label: String(value ?? '') }]}
        onchange={(next) => update(next)}
      />
    {:else if control.kind === 'string'}
      <Input
        id={`setting-${definition.key}`}
        value={String(value ?? '')}
        invalid={!!error}
        onchange={(event) => update((event.currentTarget as HTMLInputElement).value)}
      />
    {:else if control.kind === 'lines'}
      <textarea
        id={`setting-${definition.key}`}
        rows={Math.min(8, Math.max(3, (value as string[]).length + 1))}
        value={(value as string[]).join('\n')}
        onchange={(event) =>
          update(
            event.currentTarget.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
          )}></textarea>
    {:else}
      <textarea
        id={`setting-${definition.key}`}
        rows="4"
        bind:value={jsonText}
        onchange={() => {
          try {
            update(JSON.parse(jsonText));
          } catch {
            error = 'Invalid JSON';
          }
        }}></textarea>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>

  {#if inspecting}
    <table class="inspect" aria-label={`Values of ${title}`}>
      <tbody>
        {#each inspected as scope (scope)}
          {@const scoped = scope === 'default' ? definition.default : inspection.scopes[scope]}
          <tr class:effective={inspection.effectiveScope === scope}>
            <th scope="row">{SCOPE_LABELS[scope]}</th>
            <td><code>{format(scoped)}</code></td>
            <td>
              {#if scope !== 'default' && scoped !== undefined}
                <Button
                  size="sm"
                  variant="ghost"
                  onclick={() => draft.reset(definition, scope as WritableScope)}
                >
                  Reset
                </Button>
              {:else if inspection.effectiveScope === scope}
                <span class="effective-label">in use</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
  <p class="key">{definition.key}</p>
</div>

<style>
  .setting {
    padding: var(--nf-space-3) var(--nf-space-4);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .setting.pending {
    box-shadow: inset 2px 0 0 var(--nf-color-accent);
  }
  .head {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
    justify-content: space-between;
  }
  .title {
    font-weight: 600;
  }
  .marker {
    margin-left: var(--nf-space-1);
    color: var(--nf-color-text-muted);
    font-size: 9px;
    vertical-align: middle;
  }
  .marker.pending {
    color: var(--nf-color-accent-text);
  }
  .scope {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
  }
  .scope-button {
    height: 24px;
    padding: 0 var(--nf-space-2);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-sunken);
    color: var(--nf-color-text-muted);
    font: inherit;
    font-size: var(--nf-font-size-sm);
    cursor: pointer;
  }
  .description {
    max-width: 640px;
    margin: var(--nf-space-1) 0 0;
    color: var(--nf-color-text-muted);
  }
  .control {
    max-width: 480px;
    margin-top: var(--nf-space-2);
  }
  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: var(--nf-space-1) var(--nf-space-2);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-sunken);
    color: var(--nf-color-text);
    font-family: var(--nf-font-code);
    font-size: var(--nf-font-size-sm);
  }
  .error {
    margin: var(--nf-space-1) 0 0;
    color: var(--nf-color-danger);
    font-size: var(--nf-font-size-sm);
  }
  .inspect {
    margin-top: var(--nf-space-2);
    border-collapse: collapse;
    font-size: var(--nf-font-size-sm);
  }
  .inspect th {
    padding: 2px var(--nf-space-3) 2px 0;
    color: var(--nf-color-text-muted);
    font-weight: 400;
    text-align: left;
  }
  .inspect td {
    padding: 2px var(--nf-space-2) 2px 0;
  }
  .inspect tr.effective th,
  .inspect tr.effective code {
    color: var(--nf-color-accent-text);
  }
  .effective-label {
    color: var(--nf-color-text-faint);
  }
  .key {
    margin: var(--nf-space-2) 0 0;
    color: var(--nf-color-text-faint);
    font-family: var(--nf-font-code);
    font-size: 11px;
  }
</style>
