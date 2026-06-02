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
  import { type SceneSystemManager } from '$lib/client/ecs';
  import { useProject } from '$lib/client/project';

  interface Props {
    manager: SceneSystemManager;
  }

  const { manager }: Props = $props();

  const { ecs } = useProject();

  const systems = $derived(manager.store);
  const allSystems = $derived(ecs.systems.store);

  const availableSystems = $derived($allSystems.filter((s) => !$systems.includes(s.name)));

  let addOpen = $state(false);

  const handleAdd = (systemName: string) => {
    manager.add(systemName);
  };

  const onDelete = (systemName: string) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    manager.delete(systemName);
  };

  const onOpenCode = (systemName: string) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // @todo open code editor
    console.log('open code', systemName);
  };

  const onOpenSystem = (systemName: string) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // @todo open to systems tab
    console.log('open system', systemName);
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
  {#each $systems.sort() as sysName (sysName)}
    <ContextMenu>
      <ContextMenuTrigger>
        <div class="flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-800">
          <span class="i-icomoon-free-steam w-3.5 h-3.5 shrink-0 text-amber-400"></span>
          <span class="flex-1 truncate text-xs text-foreground">{sysName}</span>
        </div>
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
