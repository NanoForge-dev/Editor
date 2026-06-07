<script lang="ts">
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
  } from '$lib/components/ui/context-menu';
  import { Button } from '$lib/components/ui/button';
  import DialogAddSceneSystem from './dialog-add-scene-system.svelte';
  import SceneSystemRow from './scene-system-row.svelte';
  import type { SceneSystemManager, System } from '$lib/client/ecs';
  import { useProject } from '$lib/client/project';
  import type { Writable } from 'svelte/store';

  interface Props {
    manager: SceneSystemManager;
  }

  const { manager }: Props = $props();

  const { ecs } = useProject();

  const systems = $derived(manager.store);
  const allSystems = $derived<Writable<System[]>>(ecs.systems.store);

  const availableSystems = $derived($allSystems.filter((s) => !$systems.includes(s.name)));

  let addOpen = $state(false);

  let dragId = $state<string | null>(null);
  let dropTarget = $state<{ id: string; pos: 'before' | 'after' } | null>(null);

  const handleAdd = (systemName: string) => {
    manager.add(systemName);
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || !dropTarget || dragId === targetId) {
      dragId = null;
      dropTarget = null;
      return;
    }
    const { pos } = dropTarget;
    const sys = $systems;
    sys.splice(sys.indexOf(dragId), 1);
    sys.splice(sys.indexOf(targetId) + (pos === 'after' ? 1 : 0), 0, dragId);
    manager.store.set($systems);
    dragId = null;
    dropTarget = null;
  };

  const onDelete = (systemName: string) => (e: MouseEvent) => {
    e.stopPropagation();
    manager.delete(systemName);
  };

  const onOpenCode = (systemName: string) => (e: MouseEvent) => {
    e.stopPropagation();
    // @todo open code editor
    console.log('open code', systemName);
  };

  const onOpenSystem = (systemName: string) => (e: MouseEvent) => {
    e.stopPropagation();
    // @todo open to systems tab
    console.log('open system', systemName);
  };

  const isNext = (a: string | null, b: string | null, pos: 'before' | 'after') => {
    if (!a || !b) return false;
    if (a === b) return true;
    const aIndex = $systems.indexOf(a);
    const bIndex = $systems.indexOf(b);
    if (Math.abs(aIndex - bIndex) > 1) return false;
    if (pos === 'before') return aIndex < bIndex;
    return aIndex > bIndex;
  };
</script>

<DialogAddSceneSystem bind:open={addOpen} systems={availableSystems} onConfirm={handleAdd} />

<div
  class="flex items-center justify-between px-2 py-1 border-b border-border/50 text-muted-foreground"
>
  <span class="text-xs font-semibold tracking-wide">Systems</span>
  <Button variant="ghost" size="icon-xs" onclick={() => (addOpen = true)}>
    <span class="i-ic-baseline-add"></span>
  </Button>
</div>

<div class="py-0.5">
  {#each $systems as sysName (sysName)}
    {@const isSelf = dragId === sysName}
    {@const isDropBefore =
      !isNext(dragId, sysName, 'before') &&
      dropTarget?.id === sysName &&
      dropTarget.pos === 'before'}
    {@const isDropAfter =
      !isNext(dragId, sysName, 'after') && dropTarget?.id === sysName && dropTarget.pos === 'after'}
    {@const handle = manager.get(sysName)}

    <ContextMenu>
      <ContextMenuTrigger class="relative">
        {#if isDropBefore}
          <div
            class="absolute -top-0.25 right-0 h-0.5 w-full bg-primary z-10 pointer-events-none"
          ></div>
        {/if}
        <div
          aria-hidden="true"
          class={[
            isSelf ? 'opacity-40' : '',
            'transition-colors flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-800 group',
          ]}
          draggable="true"
          ondragstart={(e) => {
            dragId = sysName;
            e.dataTransfer!.effectAllowed = 'move';
          }}
          ondragend={() => {
            dragId = null;
            dropTarget = null;
          }}
          ondragover={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer!.dropEffect = 'move';
            const { top, height } = (e.currentTarget as HTMLElement).getBoundingClientRect();
            dropTarget = { id: sysName, pos: e.clientY - top < height * 0.5 ? 'before' : 'after' };
          }}
          ondragleave={(e) => {
            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
              if (dropTarget?.id === sysName) dropTarget = null;
            }
          }}
          ondrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDrop(sysName);
          }}
        >
          <SceneSystemRow {handle} />
          <span
            class={[
              'text-xs text-muted-foreground/50 i-ic-baseline-drag-indicator group-hover:opacity-100 duration-150 self-end',
              isSelf ? 'opacity-100' : 'opacity-0',
            ]}
          >
          </span>
        </div>
        {#if isDropAfter}
          <div
            class="absolute -bottom-0.25 right-0 h-0.5 w-full bg-primary z-10 pointer-events-none"
          ></div>
        {/if}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onclick={onOpenCode(sysName)}>
          <span class="i-ic:baseline-open-in-new"></span>
          Open code
        </ContextMenuItem>
        <ContextMenuItem onclick={onOpenSystem(sysName)}>
          <span class="i-ic:baseline-open-in-new"></span>
          Find in systems
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onclick={onDelete(sysName)}>
          <span class="i-ic-baseline-delete"></span>
          Remove from scene
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  {/each}

  {#if $systems.length === 0}
    <div class="py-6 text-center text-xs text-muted-foreground">No systems - use + to add one.</div>
  {/if}
</div>
