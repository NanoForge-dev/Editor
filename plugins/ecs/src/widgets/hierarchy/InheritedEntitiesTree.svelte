<script lang="ts">
  import { ContextMenu, type MenuEntry, Tree, type TreeNode } from '@nanoforge-dev/editor-sdk/ui';

  import type { EcsService } from '../../service/ecs-service';

  interface Props {
    ecs: EcsService;
    expanded: Set<string>;
  }

  let { ecs, expanded = $bindable() }: Props = $props();
  // svelte-ignore state_referenced_locally
  const inherited = ecs.inherited;
  // svelte-ignore state_referenced_locally
  const ecsSource = ecs.source;

  const INHERITED_PREFIX = 'inherited:';

  const nodes = $derived(
    $inherited.map(({ location: parent, model: parentModel }, index): TreeNode => ({
      id: `${INHERITED_PREFIX}${index}`,
      label: parent.label,
      icon: 'layers',
      detail: 'parent scene',
      draggable: false,
      droppable: false,
      children: parentModel.entities.map((entity) => ({
        id: `${INHERITED_PREFIX}${index}:${entity.name}`,
        label: entity.name,
        icon: 'lock',
        detail: entity.components.map((component) => component.className ?? '…').join(', '),
        draggable: false,
        droppable: false,
      })),
    })),
  );
  $effect(() => {
    const ids = nodes.map((node) => node.id);
    if (ids.some((id) => !expanded.has(id))) expanded = new Set([...expanded, ...ids]);
  });
  /** The inherited location and entity line of an inherited row. */
  const inheritedOf = (id: string) => {
    const [index, name] = id.slice(INHERITED_PREFIX.length).split(':');
    const entry = $inherited[Number(index)];
    if (!entry) return undefined;
    const line = name ? entry.model.entities.find((entity) => entity.name === name)?.line : 1;
    return { entry, line };
  };
  let menuTarget = $state<string>();
  const menu = (): MenuEntry[] => {
    const target = menuTarget ? inheritedOf(menuTarget) : undefined;
    if (!target) return [];
    const app = ecs.app;
    const edit = $ecsSource?.edit;
    return [
      {
        kind: 'item',
        id: 'open',
        label: 'Open in code',
        onSelect: () => void ecs.openInCode(target.entry.location.path, target.line),
      },
      ...(edit && app
        ? [
            {
              kind: 'item' as const,
              id: 'edit',
              label: 'Edit this scene',
              onSelect: () => edit(app, target.entry.location),
            },
          ]
        : []),
    ];
  };
</script>

{#if nodes.length}
  <ContextMenu items={menu}>
    <div class="inherited" role="presentation">
      <Tree
        label="Inherited entities"
        {nodes}
        bind:expanded
        selected={new Set()}
        onactivate={(id) => {
          const target = inheritedOf(id);
          if (target) void ecs.openInCode(target.entry.location.path, target.line);
        }}
        oncontextmenu={(id) => (menuTarget = id)}
      />
    </div>
  </ContextMenu>
{/if}

<style>
  .inherited {
    flex: none;
    max-height: 40%;
    overflow: auto;
    border-bottom: 1px solid var(--nf-color-border);
    opacity: 0.7;
  }
</style>
