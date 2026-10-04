<script lang="ts">
  import {
    Button,
    ContextMenu,
    EmptyState,
    IconButton,
    type MenuEntry,
    PromptServiceToken,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-sdk/ui';

  import { SceneLiveServiceToken } from '../../live/scene-live-service';
  import type { VarModel, VarUse } from '../../model/vars-model.type';
  import { formatValue, parseParam } from '../../model/scene-params';
  import { SceneServiceToken } from '../../service/scene-service';
  import { SCENES_HISTORY } from '../../service/scene-history.const';
  import VarRow from './VarRow.svelte';
  import { type VarField, askNewVar, askVarField } from './var-prompts';

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const scenes = instance.services.get(SceneServiceToken);
  // svelte-ignore state_referenced_locally
  const prompts = instance.services.tryGet(PromptServiceToken);
  const vars = scenes.vars;
  const model = scenes.model;
  $effect(() => instance.setHistoryContext(SCENES_HISTORY));
  // svelte-ignore state_referenced_locally
  const live = instance.services.get(SceneLiveServiceToken);
  const games = live.games;
  // svelte-ignore state_referenced_locally
  const visible = instance.visible;
  $effect(() => {
    if (!$visible) return;
    const watching = live.watch();
    return () => watching.dispose();
  });
  const appId = scenes.appId;
  const game = $derived($games.find((candidate) => candidate.app === $appId));
  const liveVar = (key: string) => game?.vars.find((entry) => entry.key === key);
  /** Vars of the running game that the code neither declares nor names. */
  const runtimeOnly = $derived.by(() => {
    const known = new Set([
      ...($vars?.vars ?? []).map((field) => field.name),
      ...($vars?.uses ?? []).map((use) => use.key),
    ]);
    return (game?.vars ?? []).filter((entry) => !known.has(entry.key));
  });

  const setLive = async (key: string, type: string) => {
    const current = liveVar(key);
    if (!game || !prompts) return;
    const text = await prompts.ask({
      title: `Live value of ${key}`,
      label: `${key} (${type})`,
      value: current
        ? typeof current.value === 'string'
          ? current.value
          : JSON.stringify(current.value)
        : '',
      confirm: 'Set',
    });
    if (text !== undefined) live.setVar(game, key, parseParam({ type }, text));
  };

  const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
  let open = $state<string>();
  let menuTarget = $state<string>();

  const usesOf = (key: string) => ($vars?.uses ?? []).filter((use) => use.key === key);
  /** The scenes that make a var (`init`): its possible owners. */
  const ownersOf = (key: string) => {
    const classes = new Set(
      usesOf(key)
        .filter((use) => use.kind === 'init' && use.className)
        .map((use) => use.className!),
    );
    return ($model?.scenes ?? [])
      .filter((scene) => classes.has(scene.className))
      .map((scene) => scene.id);
  };
  /** Keys used in code with no declaration. */
  const undeclared = $derived.by(() => {
    const declared = new Set(($vars?.vars ?? []).map((field) => field.name));
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a throwaway copy
    const keys = new Map<string, VarUse[]>();
    for (const use of $vars?.uses ?? [])
      if (!declared.has(use.key)) keys.set(use.key, [...(keys.get(use.key) ?? []), use]);
    return [...keys];
  });

  const nameProblem = (value: string, current?: string) => {
    if (!IDENTIFIER.test(value)) return 'Use letters, digits, _ or $, not starting with a digit.';
    if (value !== current && ($vars?.vars ?? []).some((field) => field.name === value))
      return `${value} already exists.`;
    return undefined;
  };

  const add = async (key?: string, type?: string) => {
    if (!prompts) return;
    const created = await askNewVar(prompts, nameProblem, key, type);
    if (created)
      await scenes.addVar(created.name, created.type, created.description, created.fallback);
  };

  const edit = async (field: VarModel, what: VarField) => {
    if (!prompts) return;
    const value = await askVarField(prompts, field, what, nameProblem);
    if (value !== undefined) await scenes.updateVar(field.name, { [what]: value });
  };

  const menu = (): MenuEntry[] => {
    const field = $vars?.vars.find((candidate) => candidate.name === menuTarget);
    if (!field) {
      const runtime = runtimeOnly.find((entry) => entry.key === menuTarget);
      return runtime
        ? [
            {
              kind: 'item',
              id: 'live',
              label: 'Set live value…',
              onSelect: () => void setLive(runtime.key, 'json'),
            },
          ]
        : [{ kind: 'item', id: 'add', label: 'Add var…', onSelect: () => void add() }];
    }
    return [
      ...(game
        ? [
            {
              kind: 'item' as const,
              id: 'live',
              label: 'Set live value…',
              disabled: !liveVar(field.name),
              onSelect: () => void setLive(field.name, field.type),
            },
            { kind: 'separator' as const },
          ]
        : []),
      { kind: 'item', id: 'rename', label: 'Rename…', onSelect: () => void edit(field, 'rename') },
      { kind: 'item', id: 'type', label: 'Change type…', onSelect: () => void edit(field, 'type') },
      {
        kind: 'item',
        id: 'default',
        label: 'Change default…',
        onSelect: () => void edit(field, 'default'),
      },
      {
        kind: 'item',
        id: 'description',
        label: 'Change description…',
        onSelect: () => void edit(field, 'description'),
      },
      { kind: 'separator' },
      {
        kind: 'item',
        id: 'remove',
        label: 'Remove',
        onSelect: () => void scenes.removeVar(field.name),
      },
    ];
  };
</script>

<div class="vars">
  <div class="toolbar">
    <span class="title">{$vars?.file ?? 'Scene vars'}</span>
    <IconButton icon="plus" label="Add var" disabled={!$vars} onclick={() => void add()} />
  </div>
  {#if !scenes.apps.length}
    <EmptyState
      icon="variable"
      title="No app with scenes"
      description="Apps that use @nanoforge-dev/scene show their scene vars here."
    />
  {:else if !$vars}
    <EmptyState icon="variable" title="Reading the vars…" />
  {:else}
    <ContextMenu items={menu}>
      <div
        class="list"
        role="presentation"
        oncontextmenu={(event) => {
          const row = (event.target as HTMLElement).closest('[data-var]');
          menuTarget = row?.getAttribute('data-var') ?? undefined;
        }}
      >
        {#if !$vars.vars.length && !undeclared.length}
          <EmptyState
            icon="variable"
            title="No var yet"
            description="Scene vars are shared by scenes and systems: ctx.scenes.vars."
          />
        {/if}
        <ul aria-label="Scene vars">
          {#each $vars.vars as field (field.name)}
            {@const uses = usesOf(field.name)}
            {@const owners = ownersOf(field.name)}
            <VarRow
              {field}
              {uses}
              {owners}
              playing={!!game}
              value={liveVar(field.name)}
              open={open === field.name}
              ontoggle={() => (open = open === field.name ? undefined : field.name)}
              onopen={(use) => void scenes.openInCode(use.path, use.line)}
            />
          {/each}
        </ul>
        {#if runtimeOnly.length}
          <h3>Only in the running game</h3>
          <ul aria-label="Runtime vars">
            {#each runtimeOnly as entry (entry.key)}
              <li data-var={entry.key} aria-label={entry.key} class="undeclared">
                <span class="name">{entry.key}</span>
                <span class="value">{formatValue(entry.value)}</span>
                <span class="detail"
                  >{entry.persistent ? 'persistent' : entry.owner ? `of ${entry.owner}` : ''}</span
                >
              </li>
            {/each}
          </ul>
        {/if}
        {#if undeclared.length}
          <h3>Used but not declared</h3>
          <ul aria-label="Undeclared vars">
            {#each undeclared as [key, uses] (key)}
              <li aria-label={key} class="undeclared">
                <span class="name">{key}</span>
                <span class="detail">{uses.length} use{uses.length > 1 ? 's' : ''}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onclick={() =>
                    void add(key, uses.find((use) => use.valueType)?.valueType ?? 'unknown')}
                  >Declare {key}</Button
                >
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </ContextMenu>
  {/if}
</div>

<style>
  .vars {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .toolbar {
    display: flex;
    flex: none;
    gap: var(--nf-space-2);
    align-items: center;
    padding: var(--nf-space-1) var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .title {
    flex: 1;
    overflow: hidden;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    padding: 2px var(--nf-space-2);
  }
  .name {
    font-weight: 600;
  }
  .value {
    color: var(--nf-color-success, #6ab04c);
    font-family: var(--nf-font-mono, monospace);
  }
  .detail {
    margin-left: auto;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  h3 {
    margin: var(--nf-space-2) var(--nf-space-2) 0;
    color: var(--nf-color-warning, #e0a03a);
    font-size: var(--nf-font-size-sm);
  }
  .undeclared {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
  }
</style>
