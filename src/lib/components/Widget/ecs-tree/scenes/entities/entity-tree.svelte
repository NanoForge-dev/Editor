<script lang="ts">
  import { setContext, untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';

  import type { Entity, Scene, SceneEntityManager } from '$lib/client/ecs';
  import { Button } from '$lib/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
  } from '$lib/components/ui/dropdown-menu';

  import { ENTITY_DRAG_KEY } from '../../const';
  import { buildTree, folderPaths } from '../../utils';
  import { type EntityDragContext, type EntityDragItem } from '../../types';
  import DialogNewEntity from './dialog-new-entity.svelte';
  import EntityTreeNode from './entity-tree-node.svelte';
  import FolderTreeNode from './folder-tree-node.svelte';
  import { useProject } from '$lib/client/project';
  import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
  } from '$lib/components/ui/input-group';

  interface Props {
    manager: SceneEntityManager;
  }

  const { manager }: Props = $props();

  const { ecs } = useProject();

  const entities = $derived(manager.store);
  const scenes = $derived(ecs.scenes.store);

  const resolveParentScene = (sceneId?: string): Scene | undefined => {
    return $scenes.find((s) => s.subScenes.includes(sceneId ?? manager.scene.id));
  };

  const resolveParentEntities = (sceneId?: string): (Entity & { scene: string })[] => {
    const parent = resolveParentScene(sceneId);
    if (!parent) return [];
    return [
      ...resolveParentEntities(parent.id),
      ...parent.entities.map((e) => ({ ...e, scene: parent.id })),
    ];
  };

  const inherited = $derived(resolveParentEntities());
  const ancestor = $derived(resolveParentScene());

  let folders = new SvelteSet<string>();
  let folderSceneId = $state('');

  let search = $state('');
  let searchOpen = $state(false);

  $effect.pre(() => {
    const id = manager.scene.id;
    if (id !== folderSceneId) {
      untrack(() => {
        folderSceneId = id;
        $entities.forEach((e) => folderPaths(e.treePath).forEach((p) => folders.add(p)));
      });
    }
  });

  const trackFolders = (treePath: string) => {
    folderPaths(treePath).forEach((p) => folders.add(p));
  };

  const untrackFolders = (folderPath: string) => {
    folders.delete(folderPath);
    for (const p of [...folders]) if (p.startsWith(folderPath + '/')) folders.delete(p);
  };

  const tree = $derived(buildTree($entities, folders, search));
  const inheritedTree = $derived(buildTree(inherited, [], search));

  let expandedFolders = new SvelteSet<string>();
  let inheritedCollapsed = $state(true);

  const toggleFolder = (path: string) => {
    if (!expandedFolders.has(path)) {
      expandedFolders.add(path);
      return;
    }
    for (const p of [...expandedFolders]) if (p.startsWith(path + '/')) expandedFolders.delete(p);
    expandedFolders.delete(path);
  };

  let dragging = $state<EntityDragItem | null>(null);
  let rootDropHovered = $state(false);

  const moveFolderTo = (oldPath: string, newPath: string) => {
    if (oldPath === newPath || newPath.startsWith(oldPath + '/')) return;
    $entities.forEach((e) => {
      const handle = manager.get(e.id);
      if (e.treePath === oldPath) return handle.update({ treePath: newPath });
      if (e.treePath.startsWith(oldPath + '/'))
        return handle.update({ treePath: newPath + e.treePath.slice(oldPath.length) });
    });
    untrackFolders(oldPath);
    trackFolders(newPath);
  };

  const dropOnFolder = (folderPath: string) => {
    if (!dragging) return;
    if (dragging.type === 'entity') {
      const handle = manager.get(dragging.id);
      if (handle.data.treePath !== folderPath) handle.update({ treePath: folderPath });
      trackFolders(folderPath);
    } else {
      const { path } = dragging as { type: 'folder'; path: string };
      if (path === folderPath || folderPath.startsWith(path + '/')) return;
      const name = path.split('/').pop()!;
      moveFolderTo(path, folderPath ? `${folderPath}/${name}` : name);
    }
    dragging = null;
  };

  const dropOnEntity = (entityId: string) => {
    if (!dragging) return;
    const target = $entities.find((e) => e.id === entityId);
    if (!target) {
      dragging = null;
      return;
    }
    const targetPath = target.treePath;

    if (dragging.type === 'entity') {
      const { id } = dragging as { type: 'entity'; id: string };
      if (id !== entityId) {
        const handle = manager.get(id);
        if (handle.data.treePath !== targetPath) handle.update({ treePath: targetPath });
        trackFolders(targetPath);
      }
    } else {
      const { path } = dragging as { type: 'folder'; path: string };
      const name = path.split('/').pop()!;
      const newPath = targetPath ? `${targetPath}/${name}` : name;
      moveFolderTo(path, newPath);
    }
    dragging = null;
  };

  const dropOnRoot = () => {
    if (!dragging) return;
    if (dragging.type === 'entity') {
      const { id } = dragging as { type: 'entity'; id: string };
      const handle = manager.get(id);
      if (handle.data.treePath !== '') handle.update({ treePath: '' });
    } else {
      const { path } = dragging as { type: 'folder'; path: string };
      const name = path.split('/').pop()!;
      if (path !== name) moveFolderTo(path, name);
    }
    dragging = null;
  };

  setContext<EntityDragContext>(ENTITY_DRAG_KEY, {
    get dragging() {
      return dragging;
    },
    startDrag: (item) => {
      dragging = item;
    },
    endDrag: () => {
      dragging = null;
    },
    dropOnFolder,
    dropOnEntity,
    dropOnRoot,
  });

  let newEntityOpen = $state(false);
  let newFolderOpen = $state(false);
  let newPath = $state('');

  const resetTarget = () => {
    newPath = '';
  };

  const handleNewEntity = (name: string) => {
    manager.add({ name, treePath: newPath, components: {} });
    resetTarget();
  };

  const handleNewFolder = (name: string) => {
    const fullPath = newPath ? `${newPath}/${name}` : name;
    folders.add(fullPath);
    resetTarget();
  };

  const onNew = (kind: 'entity' | 'folder', path: string) => {
    return (e: MouseEvent) => {
      e.stopPropagation();
      newPath = path;
      if (kind === 'entity') newEntityOpen = true;
      else newFolderOpen = true;
    };
  };
</script>

<DialogNewEntity kind="entity" bind:open={newEntityOpen} onConfirm={handleNewEntity} />
<DialogNewEntity kind="folder" bind:open={newFolderOpen} onConfirm={handleNewFolder} />

<div class="px-2 py-1 border-b border-border/50 text-muted-foreground">
  <div class="flex items-center justify-between">
    <span class="text-xs font-semibold tracking-wide">Entities</span>
    <div class="flex items-center gap-1">
      <Button
        size="icon-xs"
        variant="ghost"
        onclick={() => {
          searchOpen = !searchOpen;
          search = '';
        }}
      >
        <span class={[searchOpen ? 'i-ic-outline-filter-alt-off' : 'i-ic-outline-filter-alt']}
        ></span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger>
          {#snippet child({ props })}
            <Button variant="ghost" size="icon-xs" {...props}>
              <span class="i-ic-baseline-add"></span>
            </Button>
          {/snippet}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onclick={onNew('entity', '')}>
            <span class="i-ic-baseline-category"></span>
            New entity
          </DropdownMenuItem>
          <DropdownMenuItem onclick={onNew('folder', '')}>
            <span class="i-ic-baseline-folder"></span>
            New folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
  {#if searchOpen}
    <InputGroup class="h-6 my-1">
      <InputGroupInput
        placeholder="Search entities..."
        bind:value={search}
        class="text-xs md:text-xs"
      />
      <InputGroupAddon>
        <span class="i-ic-baseline-search h-4"></span>
      </InputGroupAddon>
      {#if search}
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            onclick={() => (search = '')}
            variant="ghost"
            class="rounded-md text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <span class="i-ic-round-close h-4 w-4"></span>
          </InputGroupButton>
        </InputGroupAddon>
      {/if}
    </InputGroup>
  {/if}
</div>

{#if ancestor && inherited.length > 0}
  <div class="border-b border-border/30">
    <button
      class="flex w-full items-center gap-1.5 px-2 py-1 text-xs text-purple-400 hover:bg-neutral-800/60 transition-colors"
      onclick={() => (inheritedCollapsed = !inheritedCollapsed)}
    >
      <span
        class="w-3 h-3 shrink-0 {inheritedCollapsed
          ? 'i-ic-baseline-keyboard-arrow-right'
          : 'i-ic-baseline-keyboard-arrow-down'}"
      ></span>
      <span class="i-ic-baseline-link w-3.5 h-3.5 shrink-0"></span>
      <span class="flex-1 truncate text-left">
        Inherited from {ancestor.name}
      </span>
      <span class="text-xs text-muted-foreground/50 shrink-0">{inherited.length}</span>
    </button>
    {#if !inheritedCollapsed}
      <div class="py-0.5 bg-neutral-900/40">
        {#each inheritedTree as node (node.kind === 'entity' ? node.id : node.path)}
          {#if node.kind === 'entity'}
            <EntityTreeNode
              handle={node.scene
                ? ecs.scenes.get(node.scene).entities.get(node.id)
                : manager.get(node.id)}
              readonly={true}
            />
          {:else}
            <FolderTreeNode
              {manager}
              {node}
              {folders}
              {expandedFolders}
              readonly={true}
              onToggleFolder={toggleFolder}
            />
          {/if}
        {/each}
      </div>
    {/if}
  </div>
{/if}

<div class="py-0.5">
  {#each tree as node (node.kind === 'entity' ? node.id : node.path)}
    {#if node.kind === 'entity'}
      <EntityTreeNode handle={manager.get(node.id)} {onNew} />
    {:else}
      <FolderTreeNode
        {manager}
        {node}
        {folders}
        {expandedFolders}
        onToggleFolder={toggleFolder}
        {onNew}
      />
    {/if}
  {/each}

  {#if $entities.length === 0 && folders.size === 0}
    <div class="py-6 text-center text-xs text-muted-foreground">
      No entities - use + to add one.
    </div>
  {/if}
</div>

{#if dragging}
  <div
    aria-hidden="true"
    class="mx-2 mb-2 mt-1 flex h-5 items-center justify-center rounded border border-dashed text-xs transition-colors
      {rootDropHovered
      ? 'border-primary/60 bg-primary/10 text-purple-400/80'
      : 'border-border/40 text-muted-foreground/30'}"
    ondragover={(e) => {
      e.preventDefault();
      e.stopPropagation();
      rootDropHovered = true;
    }}
    ondragleave={() => (rootDropHovered = false)}
    ondrop={(e) => {
      e.preventDefault();
      rootDropHovered = false;
      dropOnRoot();
    }}
  >
    Drop here → root
  </div>
{/if}
