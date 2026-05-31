<script lang="ts">
  import { getContext } from 'svelte';

  import type { SceneEntityHandle } from '$lib/client/ecs';
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
  } from '$lib/components/ui/context-menu';

  import { ENTITY_DRAG_KEY } from '../../const';
  import { resolveParentPath } from '../../utils';
  import type { EntityDragContext } from '../../types';
  import DialogEditEntity from './dialog-edit-entity.svelte';
  import DialogDeleteEntity from './dialog-delete-entity.svelte';

  interface Props {
    handle: SceneEntityHandle;
    depth?: number;
    readonly?: boolean;
    onNew?: (kind: 'entity' | 'folder', path: string) => void;
  }

  const { handle, depth = 0, readonly = false, onNew = () => {} }: Props = $props();

  const drag = getContext<EntityDragContext>(ENTITY_DRAG_KEY);

  const entity = $derived(handle.store);
  const selectedEntity = $derived(handle.manager.selected);

  const pl = $derived(8 + depth * 12);

  let editOpen = $state(false);
  let deleteOpen = $state(false);

  let hovered = $state(false);

  const isDragging = $derived(drag.dragging?.type === 'entity' && drag.dragging.id === $entity.id);

  const onSelect = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handle.setSelected();
  };

  const handleEdit = (name: string) => {
    handle.update({ name });
  };

  const handleDelete = () => {
    handle.delete();
  };

  const onEdit = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    editOpen = true;
  };

  const onDelete = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteOpen = true;
  };
</script>

<DialogEditEntity
  kind="entity"
  bind:open={editOpen}
  defaultValue={$entity.name}
  onConfirm={handleEdit}
/>
<DialogDeleteEntity
  kind="entity"
  bind:open={deleteOpen}
  name={$entity.name}
  onConfirm={handleDelete}
/>
<ContextMenu>
  <ContextMenuTrigger>
    <button
      draggable={!readonly}
      class={`flex w-full items-center gap-1.5 py-0.5 pr-2 transition-colors
          ${
            $selectedEntity?.id === $entity.id
              ? 'bg-primary/20 text-purple-300'
              : 'text-neutral-300 hover:bg-neutral-800'
          }
          ${hovered && !isDragging ? 'ring-2 ring-inset ring-blue-primary' : ''}
          ${isDragging ? 'opacity-40' : ''}`}
      style="padding-left:{pl}px"
      onclick={onSelect}
      ondragstart={(e) => {
        e.stopPropagation();
        e.dataTransfer!.effectAllowed = 'move';
        drag.startDrag({ type: 'entity', id: $entity.id });
      }}
      ondragend={() => {
        drag.endDrag();
        hovered = false;
      }}
      ondragover={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer!.dropEffect = 'move';
        hovered = true;
      }}
      ondragleave={() => (hovered = false)}
      ondrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        hovered = false;
        drag.dropOnEntity($entity.id);
      }}
    >
      <span class="w-3 h-3 shrink-0"></span>
      <span class="i-ic-baseline-category w-3.5 h-3.5 shrink-0 text-sky-400"></span>
      <span class="flex-1 truncate text-left text-xs {readonly ? 'text-neutral-400' : ''}">
        {$entity.name}
      </span>
      <span class="text-xs text-muted-foreground/50 shrink-0">
        {Object.keys($entity.components).length}
      </span>
    </button>
  </ContextMenuTrigger>
  {#if !readonly}
    <ContextMenuContent>
      <ContextMenuItem onclick={() => onNew('entity', resolveParentPath($entity.treePath))}>
        <span class="i-ic-baseline-add-circle"></span>
        New entity
      </ContextMenuItem>
      <ContextMenuItem onclick={() => onNew('folder', resolveParentPath($entity.treePath))}>
        <span class="i-ic-baseline-folder"></span>
        New folder
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onclick={onEdit}>
        <span class="i-ic-baseline-edit"></span>
        Edit
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onclick={onDelete}>
        <span class="i-ic-baseline-delete"></span>
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  {/if}
</ContextMenu>
