<script lang="ts">
  import { documentHistoryId } from '@nanoforge-dev/editor-sdk';
  import {
    ContextMenu,
    type DropPosition,
    EmptyState,
    IconButton,
    Input,
    type MenuEntry,
    Select,
    Tree,
    type TreeNode,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-sdk/ui';

  import { EcsServiceToken } from '../../service/ecs-service';
  import type { LiveSource } from '../../live/live.type';
  import { LiveServiceToken } from '../../live/live-service';
  import InheritedEntitiesTree from './InheritedEntitiesTree.svelte';
  import LiveEntitiesTree from './LiveEntitiesTree.svelte';

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const ecs = instance.services.get(EcsServiceToken);
  const location = ecs.location;
  const ecsSource = ecs.source;
  $effect(() => {
    const path = $location?.path;
    instance.setHistoryContext(path ? documentHistoryId(path) : undefined);
  });
  const apps = ecs.apps;
  const appId = ecs.appId;
  const model = ecs.model;
  const selection = ecs.selection;
  // svelte-ignore state_referenced_locally
  const live = instance.services.get(LiveServiceToken);
  const playing = live.playing;
  const instances = live.instances;
  let chosenSource = $state<LiveSource>();
  const liveMode = $derived($playing && $instances.length > 0);
  const source = $derived(
    $instances.find((candidate) => candidate.source === chosenSource)?.source ??
      $instances[0]?.source,
  );
  const liveInstance = $derived($instances.find((candidate) => candidate.source === source));
  let liveExpanded = $state(new Set<string>());
  let inheritedExpanded = $state(new Set<string>());

  let filter = $state('');
  let menuTarget = $state<string>();
  let tree = $state<{ rename: (id: string) => void }>();

  const CODE_PREFIX = 'code:';
  const nodes = $derived.by((): TreeNode[] => {
    const query = filter.trim().toLowerCase();
    const matches = (name: string, components: readonly string[]) =>
      !query ||
      name.toLowerCase().includes(query) ||
      components.some((component) => component.toLowerCase().includes(query));
    const entities = ($model?.entities ?? [])
      .filter((entity) =>
        matches(
          entity.name,
          entity.components.map((component) => component.className ?? ''),
        ),
      )
      .map((entity) => ({
        id: entity.name,
        label: entity.name,
        icon: 'box',
        detail: entity.components.map((component) => component.className ?? '…').join(', '),
      }));
    const codeOnly = query
      ? []
      : ($model?.codeOnly ?? []).map((entry) => ({
          id: `${CODE_PREFIX}${entry.line}`,
          label: `Line ${entry.line}`,
          icon: 'lock',
          detail: 'from code',
          draggable: false,
          droppable: false,
        }));
    return [...entities, ...codeOnly];
  });

  const selected = $derived(new Set($selection ? [$selection] : []));

  const lineOf = (id: string) =>
    id.startsWith(CODE_PREFIX)
      ? Number(id.slice(CODE_PREFIX.length))
      : $model?.entities.find((entity) => entity.name === id)?.line;

  const openInCode = (id: string) => {
    if ($model) void ecs.openInCode($model.path, lineOf(id));
  };

  const move = (ids: string[], target: string, position: DropPosition) => {
    const [entity] = ids;
    if (!entity || entity === target || target.startsWith(CODE_PREFIX)) return;
    const names = ($model?.entities ?? []).map((candidate) => candidate.name);
    const before =
      position === 'after' || position === 'inside' ? names[names.indexOf(target) + 1] : target;
    void ecs.apply(
      { kind: 'moveEntity', entity, ...(before && before !== entity && { before }) },
      `Move ${entity}`,
    );
  };

  const menu = (): MenuEntry[] => {
    const id = menuTarget;
    if (!id) return [{ kind: 'item', id: 'add', label: 'Add entity', onSelect: add }];
    if (id.startsWith(CODE_PREFIX))
      return [{ kind: 'item', id: 'open', label: 'Open in code', onSelect: () => openInCode(id) }];
    return [
      {
        kind: 'item',
        id: 'duplicate',
        label: 'Duplicate',
        onSelect: () => void ecs.apply({ kind: 'duplicateEntity', entity: id }, `Duplicate ${id}`),
      },
      {
        kind: 'item',
        id: 'rename',
        label: 'Rename',
        shortcut: 'F2',
        onSelect: () => setTimeout(() => tree?.rename(id), 150),
      },
      { kind: 'item', id: 'open', label: 'Open in code', onSelect: () => openInCode(id) },
      { kind: 'separator' },
      {
        kind: 'item',
        id: 'remove',
        label: 'Remove',
        onSelect: () => void ecs.apply({ kind: 'removeEntity', entity: id }, `Remove ${id}`),
      },
    ];
  };

  const add = () => void ecs.apply({ kind: 'addEntity' }, 'Add entity');
</script>

<div class="hierarchy">
  <div class="toolbar">
    {#if liveMode}
      <Select
        label="Running game"
        value={source ?? ''}
        items={$instances.map((candidate) => ({
          value: candidate.source,
          label: `${candidate.source === 'client' ? 'Client' : 'Server'} (running)`,
        }))}
        onchange={(value) => (chosenSource = value as LiveSource)}
      />
    {:else if $apps.length > 1}
      <Select
        label="App"
        value={$appId ?? ''}
        items={$apps.map((app) => ({ value: app.id, label: app.name }))}
        onchange={(id) => ecs.selectApp(id)}
      />
    {/if}
    <Input bind:value={filter} placeholder="Filter" aria-label="Filter entities" />
    {#if liveMode}
      <IconButton
        icon="plus"
        label="Spawn an entity in the game"
        onclick={() => source && live.spawnEntity(source)}
      />
    {:else}
      <IconButton icon="plus" label="Add entity" onclick={add} disabled={!$model?.found} />
    {/if}
  </div>

  {#if liveMode}
    <LiveEntitiesTree
      {live}
      instance={liveInstance}
      {source}
      {filter}
      bind:expanded={liveExpanded}
    />
  {:else if !$apps.length}
    <EmptyState
      icon="box"
      title="No app with the ECS"
      description="Apps that use @nanoforge-dev/ecs show their entities here."
    />
  {:else if $ecsSource && !$location}
    <EmptyState
      icon="layers"
      title="No scene selected"
      description={$ecsSource.emptyMessage ?? 'Choose what to edit.'}
    />
  {:else if $model && !$model.found}
    <EmptyState
      icon="triangle-alert"
      title="No scene to edit"
      description={$model.problems.join(' ')}
    />
  {:else}
    <InheritedEntitiesTree {ecs} bind:expanded={inheritedExpanded} />
    {#if $location?.label}
      <div class="scene-label">{$location.label}</div>
    {/if}
    <ContextMenu items={menu}>
      <div
        class="list"
        role="presentation"
        oncontextmenu={(event) => {
          if (!(event.target as HTMLElement).closest('[data-id]')) menuTarget = undefined;
        }}
      >
        {#if nodes.length}
          <Tree
            bind:this={tree}
            label="Entities"
            {nodes}
            {selected}
            onselectionchange={(next) => {
              const [id] = [...next];
              ecs.select(id && !id.startsWith(CODE_PREFIX) ? id : undefined);
            }}
            onactivate={openInCode}
            onrename={(id, name) =>
              !id.startsWith(CODE_PREFIX) &&
              ecs.apply({ kind: 'renameEntity', entity: id, name }, `Rename ${id}`)}
            ondrop={move}
            oncontextmenu={(id) => (menuTarget = id)}
          />
        {:else}
          <EmptyState
            icon="box"
            title={filter ? 'No match' : 'No entity yet'}
            description={filter ? undefined : 'Add an entity to start.'}
          />
        {/if}
      </div>
    </ContextMenu>
  {/if}
</div>

<style>
  .hierarchy {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .toolbar {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: var(--nf-space-2);
    align-items: center;
    padding: var(--nf-space-1) var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  /* In a narrow dock the filter goes under the app selector instead of shrinking to nothing. */
  .toolbar :global(input) {
    flex: 1 1 90px;
    min-width: 0;
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .scene-label {
    flex: none;
    padding: var(--nf-space-1) var(--nf-space-2);
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
    font-weight: 600;
  }
</style>
