<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import SceneRow from './scene-row.svelte';
  import DialogNewScene from './dialog-new-scene.svelte';

  import { SvelteSet } from 'svelte/reactivity';
  import type { Scene, SceneManager } from '$lib/client/ecs';

  interface Props {
    manager: SceneManager;
    selected: string | null;
  }

  let { manager, selected = $bindable(null) }: Props = $props();

  const scenes = $derived(manager.store);

  const rootScenesIds = $derived(manager.rootScenesStore);
  const rootScenes = $derived($rootScenesIds.map((id) => $scenes.find((s) => s.id === id)!));

  let addOpen = $state(false);

  let expandedSceneItems = new SvelteSet<string>();

  let dragSceneId = $state<string | null>(null);
  let dropTarget = $state<{ id: string; pos: 'before' | 'on' | 'after' } | null>(null);

  const isDescendantOf = (targetId: string, ancestorId: string): boolean => {
    const anc = $scenes.find((s) => s.id === ancestorId);
    if (!anc) return false;
    for (const subId of anc.subScenes) {
      if (subId === targetId || isDescendantOf(targetId, subId)) return true;
    }
    return false;
  };

  const getParent = (sceneId: string): Scene | null => {
    return $scenes.find((s) => s.subScenes.includes(sceneId)) ?? null;
  };

  const detachFromParent = (sceneId: string) => {
    const parent = getParent(sceneId);
    if (!parent) {
      manager.rootScenes = manager.rootScenes.filter((id) => id !== sceneId);
      return;
    }
    const handle = manager.get(parent.id);
    handle.update({ subScenes: parent.subScenes.filter((id) => id !== sceneId) });
  };

  const handleDrop = (targetId: string) => {
    if (!dragSceneId || !dropTarget || dragSceneId === targetId) {
      dragSceneId = null;
      dropTarget = null;
      return;
    }
    const { pos } = dropTarget;
    if (pos === 'on') {
      makeChildOf(dragSceneId, targetId);
    } else {
      reorderRelativeTo(dragSceneId, targetId, pos);
    }
    dragSceneId = null;
    dropTarget = null;
  };

  const makeChildOf = (childId: string, parentId: string) => {
    if (childId === parentId || isDescendantOf(parentId, childId)) return;
    detachFromParent(childId);

    const handle = manager.get(parentId);
    handle.update({
      subScenes: [...handle.data.subScenes, childId],
    });

    expandedSceneItems.add(parentId);
  };

  const getInsertedScenes = (
    scenes: string[],
    dragId: string,
    targetId: string,
    pos: 'before' | 'after',
  ): string[] => {
    scenes.splice(scenes.indexOf(targetId) + (pos === 'after' ? 1 : 0), 0, dragId);
    return scenes;
  };

  const reorderRelativeTo = (dragId: string, targetId: string, pos: 'before' | 'after') => {
    const targetParent = getParent(targetId);
    detachFromParent(dragId);

    if (!targetParent) {
      manager.rootScenes = getInsertedScenes(manager.rootScenes, dragId, targetId, pos);
    } else {
      const handle = manager.get(targetParent.id);
      const scenes = getInsertedScenes(handle.data.subScenes, dragId, targetId, pos);
      handle.update({ subScenes: scenes });
    }
  };

  const onAdd = (name: string) => {
    manager.add({
      id: name,
      name,
      path: `./scenes/${name}.ts`,
      subScenes: [],
      assets: [],
      systems: [],
      entities: [],
    });
    manager.rootScenes = [...manager.rootScenes, name];
  };

  const toggleExpand = (id: string, force?: boolean) => {
    if (!expandedSceneItems.has(id) && force !== false) {
      expandedSceneItems.add(id);
      return;
    }
    expandedSceneItems.delete(id);
    const scene = $scenes.find((s) => s.id === id);
    if (!scene) return;
    for (const sub of scene.subScenes) toggleExpand(sub, false);
  };
</script>

<DialogNewScene bind:open={addOpen} onConfirm={onAdd} />

{#snippet sceneRow(scene: Scene, depth: number)}
  {@const isSelf = dragSceneId === scene.id}
  {@const isInvalid =
    !dragSceneId || dragSceneId === scene.id || isDescendantOf(scene.id, dragSceneId)}
  {@const isDropBefore = dropTarget?.id === scene.id && dropTarget.pos === 'before'}
  {@const isDropOn = dropTarget?.id === scene.id && dropTarget.pos === 'on'}
  {@const isDropAfter = dropTarget?.id === scene.id && dropTarget.pos === 'after'}
  {@const barLeft = 8 + depth * 12}
  {@const handle = manager.get(scene.id)}

  <div class="relative">
    <div>
      {#if isDropBefore}
        <div
          class="absolute -top-0.25 right-0 h-0.5 bg-primary z-10 pointer-events-none"
          style="left:{barLeft}px"
        ></div>
      {/if}
      <div
        aria-hidden="true"
        class="{isSelf ? 'opacity-40' : ''} {isDropOn
          ? 'ring-2 ring-inset ring-primary rounded-sm'
          : ''}"
        draggable="true"
        ondragstart={(e) => {
          dragSceneId = scene.id;
          e.dataTransfer!.effectAllowed = 'move';
        }}
        ondragend={() => {
          dragSceneId = null;
          dropTarget = null;
        }}
        ondragover={(e) => {
          if (isInvalid) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer!.dropEffect = 'move';
          const { top, height } = (e.currentTarget as HTMLElement).getBoundingClientRect();
          dropTarget = { id: scene.id, pos: e.clientY - top < height * 0.4 ? 'before' : 'on' };
        }}
        ondragleave={(e) => {
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
            if (dropTarget?.id === scene.id) dropTarget = null;
          }
        }}
        ondrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleDrop(scene.id);
        }}
      >
        <SceneRow
          {handle}
          {depth}
          isSelected={selected === scene.id}
          isExpanded={expandedSceneItems.has(scene.id)}
          onSelect={() => (selected = scene.id)}
          onToggleExpand={() => toggleExpand(scene.id)}
        />
      </div>
    </div>

    {#if expandedSceneItems.has(scene.id) && scene.subScenes.length > 0}
      {#each scene.subScenes as subId (subId)}
        {@const sub = $scenes.find((s) => s.id === subId)}
        {#if sub}{@render sceneRow(sub, depth + 1)}{/if}
      {/each}
      <div class="h-1"></div>
    {/if}

    <div class="absolute h-1 w-full bottom-0 z-10">
      {#if dragSceneId && !isInvalid}
        <div
          class="h-1"
          aria-hidden="true"
          ondragover={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer!.dropEffect = 'move';
            dropTarget = { id: scene.id, pos: 'after' };
          }}
          ondragleave={(e) => {
            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
              if (dropTarget?.id === scene.id && dropTarget.pos === 'after') dropTarget = null;
            }
          }}
          ondrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDrop(scene.id);
          }}
        >
          {#if isDropAfter}
            <div
              class="absolute -bottom-0.25 right-0 my-auto h-0.5 bg-primary pointer-events-none"
              style="left:{barLeft}px"
            ></div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/snippet}

<div class="flex w-44 shrink-0 flex-col border-r border-border">
  <div
    class="flex items-center justify-between px-2 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground"
  >
    <span>Scenes</span>
    <Button variant="ghost" size="icon-xs" onclick={() => (addOpen = true)}>
      <span class="i-ic-baseline-add"></span>
    </Button>
  </div>

  <div
    role="list"
    class="flex-1 overflow-y-auto mt-1"
    ondragover={(e) => {
      if (dragSceneId) e.preventDefault();
    }}
    ondragleave={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) dropTarget = null;
    }}
    ondrop={() => {
      dragSceneId = null;
      dropTarget = null;
    }}
  >
    {#each rootScenes as scene (scene)}
      {@render sceneRow(scene, 0)}
    {/each}
  </div>
</div>
