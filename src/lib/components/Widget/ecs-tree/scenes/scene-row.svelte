<script lang="ts">
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
  } from '$lib/components/ui/context-menu';
  import { type SceneHandle } from '$lib/client/ecs';
  import { useProject } from '$lib/client/project';
  import DialogEditScene from './dialog-edit-scene.svelte';
  import { DeleteConfirmDialog } from '$lib/components/dialogs';

  interface Props {
    handle: SceneHandle;
    isSelected: boolean;
    depth?: number;
    isExpanded?: boolean;
    onSelect: () => void;
    onToggleExpand?: () => void;
  }

  const {
    handle,
    isSelected,
    depth = 0,
    isExpanded = false,
    onSelect,
    onToggleExpand,
  }: Props = $props();

  const { ecs } = useProject();

  let editOpen = $state(false);
  let deleteOpen = $state(false);

  const scene = $derived(handle.store);
  const activeScene = $derived(ecs.scenes.active);
  const defaultScene = $derived(ecs.scenes.default);

  const isActive = $derived($activeScene.id === handle.id);
  const isDefault = $derived($defaultScene === handle.id);
  const paddingLeft = $derived(8 + depth * 12);

  const onSetActive = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handle.setActive();
  };

  const onSetDefault = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handle.setDefault();
  };

  const onUpdate = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    editOpen = true;
  };

  const handleUpdate = (name: string) => {
    handle.update({ name });
  };

  const onDelete = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteOpen = true;
  };

  const handleDelete = () => {
    handle.delete();
  };
</script>

<DialogEditScene bind:open={editOpen} defaultValue={$scene.name} onConfirm={handleUpdate} />
<DeleteConfirmDialog
  type="Scene"
  name={$scene.name}
  bind:open={deleteOpen}
  onConfirm={handleDelete}
/>

<ContextMenu>
  <ContextMenuTrigger>
    <div
      class="flex w-full items-center transition-colors
        {isSelected ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-300 hover:bg-neutral-800'}"
      style="padding-left: {paddingLeft}px"
    >
      {#if $scene.subScenes.length > 0}
        <button
          class="shrink-0 px-1 py-1 hover:text-foreground"
          aria-label="Toggle sub-scenes"
          onclick={onToggleExpand}
        >
          <span
            class="w-3 h-3 block {isExpanded
              ? 'i-ic-baseline-keyboard-arrow-down'
              : 'i-ic-baseline-keyboard-arrow-right'}"
          ></span>
        </button>
      {:else}
        <span class="w-3 h-3 shrink-0 mx-1"></span>
      {/if}
      <button class="flex flex-1 items-center gap-1.5 py-1 pr-2 min-w-0" onclick={onSelect}>
        <span class="i-clarity-picture-solid w-3.5 h-3.5 shrink-0 text-indigo-400"></span>
        <span class="flex-1 truncate text-left text-xs">{$scene.name}</span>
        {#if isDefault}
          <span class="text-[9px] font-bold leading-none text-amber-400 shrink-0" title="Default">
            D
          </span>
        {/if}
        {#if isActive}
          <span class="w-2 h-2 rounded-full shrink-0 bg-green-400" title="Active"></span>
        {/if}
      </button>
    </div>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onclick={onUpdate}>
      <span class="i-ic-baseline-edit"></span>
      Edit
    </ContextMenuItem>
    <ContextMenuSeparator />
    {#if !isActive || !isDefault}
      {#if !isActive}
        <ContextMenuItem onclick={onSetActive}>
          <span class="i-ic-round-play-arrow text-green-400"></span>
          Set active
        </ContextMenuItem>
      {/if}
      {#if !isDefault}
        <ContextMenuItem onclick={onSetDefault}>
          <span class="i-ic-baseline-star text-amber-400"></span>
          Set default
        </ContextMenuItem>
      {/if}
      <ContextMenuSeparator />
    {/if}
    <ContextMenuItem variant="destructive" onclick={onDelete}>
      <span class="i-ic-baseline-delete"></span>
      Delete
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
