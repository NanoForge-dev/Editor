<script lang="ts">
  import { documentHistoryId } from '@nanoforge-dev/editor-sdk';
  import {
    Combobox,
    ContextMenu,
    type DropPosition,
    EmptyState,
    Icon,
    type MenuEntry,
    Switch,
    Tree,
    type TreeNode,
    type WidgetInstance,
  } from '@nanoforge-dev/editor-sdk/ui';

  import { EcsServiceToken } from '../../service/ecs-service';
  import { ecsData } from '../../service/ecs-data';
  import { LiveServiceToken } from '../../live/live-service';

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const ecs = instance.services.get(EcsServiceToken);
  const location = ecs.location;
  const ecsSource = ecs.source;
  const inherited = ecs.inherited;
  $effect(() => {
    const path = $location?.path;
    instance.setHistoryContext(path ? documentHistoryId(path) : undefined);
  });
  const model = ecs.model;
  const owner = $derived($location?.scope?.kind === 'method' ? 'scene' : 'app');
  /** The parents' systems, which run before this scene's (read-only). */
  const inheritedSystems = $derived(
    $inherited.flatMap(({ location: parent, model: parentModel }) =>
      parentModel.systems.map((system) => ({
        scene: parent.label,
        name: system.name ?? system.code,
      })),
    ),
  );
  const catalog = ecs.catalogState;
  // svelte-ignore state_referenced_locally
  const live = instance.services.get(LiveServiceToken);
  const playing = live.playing;
  const instances = live.instances;
  const liveSelection = live.selection;
  const running = $derived(
    $instances.find((candidate) => candidate.source === $liveSelection?.source) ?? $instances[0],
  );
  let menuTarget = $state<number>();

  const label = (ref: string) => ref.slice(ref.indexOf('#') + 1);

  const nodes = $derived.by((): TreeNode[] => {
    void $catalog;
    return ($model?.systems ?? []).map((system, index) => {
      const data = ecsData(ecs.item(system.item));
      const reads = data?.type === 'system' ? data.query.flat().map(label).join(', ') : undefined;
      return {
        id: String(index),
        label: system.name ?? system.code,
        icon: 'settings',
        ...(reads && { detail: reads }),
      };
    });
  });

  const choices = $derived.by(() => {
    void $catalog;
    return ecs
      .items()
      .filter((item) => ecsData(item)?.type === 'system')
      .map((item) => ({
        value: item.ref,
        label: item.meta.export,
        detail: item.meta.description ?? '',
      }));
  });

  const move = (ids: string[], target: string, position: DropPosition) => {
    const from = Number(ids[0]);
    let to = Number(target);
    if (position === 'after' && to < from) to += 1;
    if (position === 'before' && to > from) to -= 1;
    if (from !== to) void ecs.apply({ kind: 'moveSystem', from, to }, 'Reorder systems');
  };

  const menu = (): MenuEntry[] => {
    const index = menuTarget;
    const system = index === undefined ? undefined : $model?.systems[index];
    if (index === undefined || !system) return [];
    const item = ecs.item(system.item);
    return [
      {
        kind: 'item',
        id: 'open',
        label: 'Open source',
        disabled: !item,
        onSelect: () => item && void ecs.openItem(item),
      },
      { kind: 'separator' },
      {
        kind: 'item',
        id: 'remove',
        label: `Remove from ${owner}`,
        onSelect: () =>
          void ecs.apply({ kind: 'removeSystem', index }, `Remove ${system.name ?? 'system'}`),
      },
    ];
  };

  const add = (ref: string) => {
    const item = ecs.item(ref);
    if (item)
      void ecs.apply(
        { kind: 'addSystem', name: item.meta.export, imports: [ecs.importOf(item)] },
        `Add ${item.meta.export}`,
      );
  };
</script>

<div class="systems">
  {#if $playing && running}
    <ul class="live" aria-label="Systems of the running {running.source}">
      {#each running.systems as system (system.index)}
        <li>
          <Switch
            label="Run {system.name}"
            checked={system.enabled}
            onchange={(enabled) => live.setSystemEnabled(running.source, system.index, enabled)}
          />
          <span class:paused={!system.enabled}>{system.name}</span>
        </li>
      {/each}
    </ul>
  {:else if $ecsSource && !$location}
    <EmptyState
      icon="layers"
      title="No scene selected"
      description={$ecsSource.emptyMessage ?? 'Choose what to edit.'}
    />
  {:else if !$model?.found}
    <EmptyState
      icon="settings"
      title="No systems"
      description="Systems of the selected {owner} show here."
    />
  {:else}
    {#if inheritedSystems.length}
      <ul class="inherited" aria-label="Systems of the parent scenes">
        {#each inheritedSystems as system, index (index)}
          <li><Icon name="lock" size={12} />{system.name} <em>{system.scene}</em></li>
        {/each}
      </ul>
    {/if}
    <ContextMenu items={menu}>
      <div class="list">
        {#if nodes.length}
          <Tree
            label="Systems in run order"
            {nodes}
            ondrop={move}
            oncontextmenu={(id) => (menuTarget = Number(id))}
            onactivate={(id) => {
              const item = ecs.item($model?.systems[Number(id)]?.item);
              if (item) void ecs.openItem(item);
            }}
          />
        {:else}
          <EmptyState icon="settings" title="No system yet" description="Add one below." />
        {/if}
      </div>
    </ContextMenu>
    <div class="add">
      <Combobox
        label="Add system"
        placeholder="Add system…"
        value=""
        items={choices}
        onchange={add}
      />
    </div>
  {/if}
</div>

<style>
  .systems {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .live {
    margin: 0;
    padding: var(--nf-space-2);
    list-style: none;
  }
  .live li {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
    padding: 2px 0;
  }
  .paused {
    color: var(--nf-color-text-muted);
    text-decoration: line-through;
  }
  .inherited {
    flex: none;
    margin: 0;
    padding: var(--nf-space-1) var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
    color: var(--nf-color-text-muted);
    list-style: none;
  }
  .inherited li {
    display: flex;
    gap: var(--nf-space-2);
    align-items: baseline;
    padding: 2px 0;
  }
  .inherited em {
    margin-left: auto;
    font-size: var(--nf-font-size-sm);
    font-style: normal;
  }
  .add {
    flex: none;
    padding: var(--nf-space-2);
    border-top: 1px solid var(--nf-color-border);
  }
</style>
