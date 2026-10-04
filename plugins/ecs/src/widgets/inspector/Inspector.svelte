<script lang="ts">
  import { documentHistoryId } from '@nanoforge-dev/editor-sdk';
  import { Combobox, EmptyState, type WidgetInstance } from '@nanoforge-dev/editor-sdk/ui';

  import { EcsServiceToken } from '../../service/ecs-service';
  import { ecsData } from '../../service/ecs-data';
  import { initialArgs } from '../../model/arg-values';
  import { LiveServiceToken } from '../../live/live-service';
  import ComponentCard from './ComponentCard.svelte';
  import LiveInspector from './LiveInspector.svelte';

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const ecs = instance.services.get(EcsServiceToken);
  const undoTarget = ecs.appId;
  $effect(() => {
    void $undoTarget;
    const entryFile = ecs.app?.entryFile;
    instance.setHistoryContext(entryFile ? documentHistoryId(entryFile) : undefined);
  });
  const model = ecs.model;
  const selection = ecs.selection;
  const catalog = ecs.catalogState;
  const shownState = ecs.shown;
  const editors = ecs.fieldEditors;
  const presets = ecs.paramPresets;
  // svelte-ignore state_referenced_locally
  const live = instance.services.get(LiveServiceToken);
  const playing = live.playing;
  const instances = live.instances;
  const liveSelection = live.selection;
  const liveTarget = $derived.by(() => {
    if (!$playing || !$liveSelection) return undefined;
    const running = $instances.find((candidate) => candidate.source === $liveSelection.source);
    const entity = running?.entities.find((candidate) => candidate.id === $liveSelection.id);
    return running && entity ? { running, entity } : undefined;
  });

  const shownFor = $derived.by(() => {
    void $shownState;
    return (ref: string | undefined) => ecs.shownFor(ref);
  });

  const entity = $derived($model?.entities.find((candidate) => candidate.name === $selection));

  const choices = $derived.by(() => {
    void $catalog;
    return ecs
      .items()
      .filter((item) => ecsData(item)?.type === 'component')
      .map((item) => ({
        value: item.ref,
        label: item.meta.export,
        detail:
          item.source.kind === 'app'
            ? 'App'
            : item.source.kind === 'lib'
              ? `Shared library ${item.source.name}`
              : `Installed package ${item.source.name}`,
      }));
  });

  const addComponent = (ref: string) => {
    const item = ecs.item(ref);
    if (!item || !entity) return;
    void ecs.apply(
      {
        kind: 'addComponent',
        entity: entity.name,
        className: item.meta.export,
        args: initialArgs(item.meta.params),
        imports: [ecs.importOf(item)],
      },
      `Add ${item.meta.export} to ${entity.name}`,
    );
  };
</script>

<div class="inspector">
  {#if liveTarget}
    <LiveInspector
      {instance}
      source={liveTarget.running.source}
      app={liveTarget.running.app}
      entity={liveTarget.entity}
      editors={$editors}
      presets={$presets}
    />
  {:else if $playing && $instances.length}
    <EmptyState
      icon="play"
      title="No entity selected"
      description="Select an entity of the running game."
    />
  {:else if !entity}
    <EmptyState
      icon="box"
      title="No entity selected"
      description="Select an entity in the hierarchy."
    />
  {:else}
    <h2 class="entity">{entity.name}</h2>
    <div class="components">
      {#each entity.components as component, index (component.node.id)}
        {@const item = ecs.item(component.item)}
        {@const shown = shownFor(component.item)}
        <ComponentCard
          {component}
          {item}
          {shown}
          editors={$editors}
          presets={$presets}
          first={index === 0}
          last={index === entity.components.length - 1}
          onargs={(args, fill, imports) =>
            void ecs.apply(
              {
                kind: 'setArgs',
                entity: entity.name,
                index,
                args,
                fill,
                ...(imports && { imports }),
              },
              `Edit ${component.className ?? 'component'} of ${entity.name}`,
            )}
          onshow={(id, visible) => component.item && ecs.setShown(component.item, id, visible)}
          onmove={(offset) =>
            void ecs.apply(
              { kind: 'moveComponent', entity: entity.name, from: index, to: index + offset },
              `Move ${component.className ?? 'component'}`,
            )}
          onremove={() =>
            void ecs.apply(
              { kind: 'removeComponent', entity: entity.name, index },
              `Remove ${component.className ?? 'component'} from ${entity.name}`,
            )}
          onopen={() => item && void ecs.openItem(item)}
        />
      {/each}
    </div>
    <div class="add">
      <Combobox
        label="Add component"
        placeholder="Add component…"
        value=""
        items={choices}
        onchange={addComponent}
      />
    </div>
  {/if}
</div>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: auto;
  }
  .entity {
    margin: 0;
    padding: var(--nf-space-2);
    font-size: var(--nf-font-size-md, 14px);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .add {
    padding: var(--nf-space-2);
  }
</style>
