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

  /**
   * Row ids that follow a system when the order changes (its name and which one of that name it
   * is), so the focus stays on a system moved from the keyboard.
   */
  const ids = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a count local to this computation
    const seen = new Map<string, number>();
    return ($model?.systems ?? []).map((system) => {
      const name = system.name ?? system.code;
      const count = seen.get(name) ?? 0;
      seen.set(name, count + 1);
      return `${name}#${count}`;
    });
  });
  const indexOf = (id: string) => ids.indexOf(id);

  const nodes = $derived.by((): TreeNode[] => {
    void $catalog;
    return ($model?.systems ?? []).map((system, index) => {
      const data = ecsData(ecs.item(system.item));
      const reads = data?.type === 'system' ? data.query.flat().map(label).join(', ') : undefined;
      return {
        id: ids[index]!,
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

  /**
   * True from a reorder until the model shows it (2 s at most): a key pressed again before that
   * would read the old order, so it waits for the next press.
   */
  let moving = false;
  let movingTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    void $model;
    moving = false;
  });
  $effect(() => () => clearTimeout(movingTimer));
  const reorder = (from: number, to: number) => {
    if (moving || from === to) return;
    moving = true;
    clearTimeout(movingTimer);
    movingTimer = setTimeout(() => (moving = false), 2000);
    void ecs.apply({ kind: 'moveSystem', from, to }, 'Reorder systems').then((done) => {
      if (!done) moving = false;
    });
  };
  const move = (moved: string[], target: string, position: DropPosition) => {
    const from = indexOf(moved[0] ?? '');
    let to = indexOf(target);
    if (from < 0 || to < 0) return;
    if (position === 'after' && to < from) to += 1;
    if (position === 'before' && to > from) to -= 1;
    reorder(from, to);
  };
  const count = $derived($model?.systems.length ?? 0);

  const menu = (): MenuEntry[] => {
    const index = menuTarget;
    const system = index === undefined ? undefined : $model?.systems[index];
    if (index === undefined || !system) return [];
    const item = ecs.item(system.item);
    const step = (to: number) => () => reorder(index, to);
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
        id: 'up',
        label: 'Run earlier',
        shortcut: 'Alt+Up',
        disabled: index === 0,
        onSelect: step(index - 1),
      },
      {
        kind: 'item',
        id: 'down',
        label: 'Run later',
        shortcut: 'Alt+Down',
        disabled: index >= count - 1,
        onSelect: step(index + 1),
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
            reorderable
            oncontextmenu={(id) => (menuTarget = indexOf(id))}
            onactivate={(id) => {
              const item = ecs.item($model?.systems[indexOf(id)]?.item);
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
