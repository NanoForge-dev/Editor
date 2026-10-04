<script lang="ts">
  import { ContextMenu, type MenuEntry, Tree, type TreeNode } from '@nanoforge-dev/editor-sdk/ui';

  import type { LiveService } from '../../live/live-service';
  import type { LiveEntity, LiveInstance, LiveSource } from '../../live/live.type';

  interface Props {
    live: LiveService;
    /** The running game shown. */
    instance: LiveInstance | undefined;
    source: LiveSource | undefined;
    filter: string;
    expanded: Set<string>;
  }

  let { live, instance, source, filter, expanded = $bindable() }: Props = $props();
  // svelte-ignore state_referenced_locally
  const pending = live.pending;
  // svelte-ignore state_referenced_locally
  const liveSelection = live.selection;

  const LIVE_PREFIX = 'live:';
  const SCENE_PREFIX = 'scene:';
  const liveLabel = (entity: LiveEntity) =>
    entity.code ?? (entity.codeOnlyLine ? `Line ${entity.codeOnlyLine}` : `Entity ${entity.id}`);
  const liveNode = (entity: LiveEntity): TreeNode => ({
    id: `${LIVE_PREFIX}${entity.id}`,
    label: liveLabel(entity),
    icon: entity.runtime ? 'play' : entity.codeOnlyLine ? 'lock' : 'box',
    detail: [
      entity.components.map((component) => component.name).join(', '),
      entity.runtime ? 'runtime' : entity.codeOnlyLine ? 'from code' : '',
      instance && live.hasPending(instance.app, entity.key) ? 'changed' : '',
    ]
      .filter(Boolean)
      .join(' · '),
    draggable: false,
    droppable: false,
  });
  const nodes = $derived.by((): TreeNode[] => {
    void $pending;
    const query = filter.trim().toLowerCase();
    const shown = (instance?.entities ?? []).filter(
      (entity) =>
        !query ||
        liveLabel(entity).toLowerCase().includes(query) ||
        entity.components.some((component) => component.name.toLowerCase().includes(query)),
    );
    const scenes = [...new Set(shown.map((entity) => entity.scene).filter(Boolean))] as string[];
    return [
      ...scenes.map((scene) => ({
        id: `${SCENE_PREFIX}${scene}`,
        label: scene,
        icon: 'layers',
        detail: 'scene',
        draggable: false,
        droppable: false,
        children: shown.filter((entity) => entity.scene === scene).map(liveNode),
      })),
      ...shown.filter((entity) => !entity.scene).map(liveNode),
    ];
  });
  $effect(() => {
    const ids = nodes.filter((node) => node.children).map((node) => node.id);
    if (ids.some((id) => !expanded.has(id))) expanded = new Set([...expanded, ...ids]);
  });
  const selected = $derived(
    new Set(
      $liveSelection && $liveSelection.source === source
        ? [`${LIVE_PREFIX}${$liveSelection.id}`]
        : [],
    ),
  );
  const entityOf = (id: string) =>
    instance?.entities.find((entity) => `${LIVE_PREFIX}${entity.id}` === id);

  let menuTarget = $state<string>();
  const menu = (): MenuEntry[] => {
    const entity = menuTarget ? entityOf(menuTarget) : undefined;
    if (!entity || !instance || !source) return [];
    const app = instance.app;
    return [
      ...(entity.key
        ? [
            {
              kind: 'item' as const,
              id: 'apply',
              label: 'Apply to code',
              disabled: !live.hasPending(app, entity.key),
              onSelect: () => void live.applyToCode(app, entity.key!),
            },
          ]
        : []),
      {
        kind: 'item',
        id: 'remove',
        label: 'Remove from the game',
        onSelect: () => live.removeEntity(source, entity),
      },
    ];
  };
</script>

<ContextMenu items={menu}>
  <div class="list" role="presentation">
    <Tree
      label="Live entities"
      {nodes}
      bind:expanded
      {selected}
      onselectionchange={(next) => {
        const [id] = [...next];
        const entity = id ? entityOf(id) : undefined;
        live.select(entity && source ? { source, id: entity.id } : undefined);
      }}
      oncontextmenu={(id) => (menuTarget = id)}
    />
  </div>
</ContextMenu>

<style>
  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
</style>
