<script lang="ts">
  import { getContext } from 'svelte';
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
  } from '$lib/components/ui/context-menu';
  import type { EntityDragContext, TreeFolder } from '../../types';
  import { ENTITY_DRAG_KEY } from '../../const';
  import EntityTreeNode from './entity-tree-node.svelte';
  import FolderTreeNode from './folder-tree-node.svelte';
  import type { SceneEntityManager } from '$lib/client/ecs';
  import DialogDeleteEntity from './dialog-delete-entity.svelte';
  import DialogEditEntity from './dialog-edit-entity.svelte';
  import { resolveParentPath } from '../../utils';
  import { useProject } from '$lib/client/project';

  interface Props {
    manager: SceneEntityManager;
    node: TreeFolder;
    readonly?: boolean;
    depth?: number;
    folders: Set<string>;
    expandedFolders: Set<string>;
    onToggleFolder: (path: string) => void;
    onNew?: (kind: 'entity' | 'folder', path: string) => (e: MouseEvent) => void;
  }

  let {
    manager,
    node,
    readonly = false,
    depth = 0,
    folders = $bindable(),
    expandedFolders,
    onToggleFolder,
    onNew = () => () => {},
  }: Props = $props();

  const { ecs } = useProject();

  const drag = getContext<EntityDragContext>(ENTITY_DRAG_KEY);

  const entities = $derived(manager.store);
  const pl = $derived(8 + depth * 12);

  let editOpen = $state(false);
  let deleteOpen = $state(false);

  let hovered = $state(false);

  const isDragging = $derived(drag.dragging?.type === 'folder' && drag.dragging.path === node.path);

  const handleEdit = (name: string) => {
    const path = `${resolveParentPath(node.path)}/${name}`;

    $entities.forEach((e) => {
      if (e.treePath.startsWith(node.path))
        manager.get(e.id).update({ treePath: e.treePath.replace(node.path, path) });
    });

    folders.delete(node.path);
    folders.add(path);
    folders.forEach((p) => {
      if (p.startsWith(node.path + '/')) {
        folders.delete(p);
        folders.add(p.replace(node.path, path));
      }
    });
  };

  const handleDelete = () => {
    $entities.forEach((e) => {
      if (e.treePath.startsWith(node.path)) manager.delete(e.id);
    });

    folders.delete(node.path);
    for (const p of [...folders]) if (p.startsWith(node.path + '/')) folders.delete(p);
  };

  const onEdit = (e: MouseEvent) => {
    e.stopPropagation();
    editOpen = true;
  };

  const onDelete = (e: MouseEvent) => {
    e.stopPropagation();
    deleteOpen = true;
  };
</script>

<DialogEditEntity
  kind="folder"
  bind:open={editOpen}
  defaultValue={node.name}
  onConfirm={handleEdit}
/>
<DialogDeleteEntity
  kind="folder"
  bind:open={deleteOpen}
  name={node.name}
  onConfirm={handleDelete}
/>

<ContextMenu>
  <ContextMenuTrigger>
    <button
      draggable={!readonly}
      class="flex w-full items-center gap-1.5 py-0.5 hover:bg-neutral-800 text-muted-foreground transition-colors group
          {hovered && !isDragging ? 'bg-primary/20 ring-2 ring-inset ring-primary' : ''}
          {isDragging ? 'opacity-40' : ''}"
      style="padding-left:{pl}px; padding-right:8px"
      onclick={() => onToggleFolder(node.path)}
      ondragstart={(e) => {
        e.stopPropagation();
        e.dataTransfer!.effectAllowed = 'move';
        drag.startDrag({ type: 'folder', path: node.path });
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
        drag.dropOnFolder(node.path);
      }}
    >
      <span
        class="w-3 h-3 shrink-0 {expandedFolders.has(node.path)
          ? 'i-ic-baseline-keyboard-arrow-down'
          : 'i-ic-baseline-keyboard-arrow-right'}"
      ></span>
      <span class="i-ic-baseline-folder w-3.5 h-3.5 text-yellow-600 shrink-0"></span>
      <span class="flex-1 truncate text-left text-xs">{node.name}</span>
      <span
        class={[
          'text-xs text-muted-foreground/50 i-ic-baseline-drag-indicator duration-150',
          isDragging && !readonly ? 'opacity-100' : 'opacity-0',
          !readonly ? 'group-hover:opacity-100' : '',
        ]}
      ></span>
    </button>
  </ContextMenuTrigger>
  {#if !readonly}
    <ContextMenuContent>
      <ContextMenuItem onclick={onNew('entity', node.path)}>
        <span class="i-ic-baseline-add-circle"></span>
        New entity
      </ContextMenuItem>
      <ContextMenuItem onclick={onNew('folder', node.path)}>
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
        <span class="i-ic-baseline-delete"></span>Delete folder &amp; contents
      </ContextMenuItem>
    </ContextMenuContent>
  {/if}
</ContextMenu>

{#if expandedFolders.has(node.path)}
  {#each node.children as child (child.kind === 'entity' ? child.id : child.path)}
    {#if child.kind === 'entity'}
      <EntityTreeNode
        handle={child.scene
          ? ecs.scenes.get(child.scene).entities.get(child.id)
          : manager.get(child.id)}
        {readonly}
        depth={depth + 1}
        {onNew}
      />
    {:else}
      <FolderTreeNode
        {manager}
        node={child}
        {readonly}
        depth={depth + 1}
        bind:folders
        {expandedFolders}
        {onToggleFolder}
        {onNew}
      />
    {/if}
  {/each}
{/if}
