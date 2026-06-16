<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
  } from '$lib/components/ui/context-menu';
  import TooltipText from '$lib/components/ui/tooltip-text/tooltip-text.svelte';
  import type { PackageItems } from '../types';
  import { ASSET_ITEMS } from '../assets/asset.items';
  import { COMPONENT_ITEMS } from '../components/component.items';
  import { LIBRARY_ITEMS } from '../libraries/library.items';
  import { SYSTEM_ITEMS } from '../systems/system.items';
  import type { Package } from '../types';
  import { DeleteConfirmDialog } from '$lib/components/dialogs';
  import { capitalize } from '@utils/string';
  import type { ComponentHandle, SystemHandle, LibraryHandle, AssetHandle } from '$lib/client/ecs';
  import { useProject } from '$lib/client/project';
  import { get, type Writable } from 'svelte/store';
  import { tabsStore } from '$lib/components/Tabs/store';
  import { getType } from '@utils/file';
  import { Spinner } from '$lib/components/ui/spinner';

  type Props =
    | {
        type: 'asset';
        handle: AssetHandle;
      }
    | {
        type: 'component';
        handle: ComponentHandle;
      }
    | {
        type: 'system';
        handle: SystemHandle;
      }
    | {
        type: 'library';
        handle: LibraryHandle;
      };

  const ITEMS = {
    asset: ASSET_ITEMS,
    component: COMPONENT_ITEMS,
    system: SYSTEM_ITEMS,
    library: LIBRARY_ITEMS,
  };

  const { type, handle }: Props = $props();
  const { ecs } = useProject();

  const pkg = $derived<Writable<Package>>(handle.store);

  const activeScene = $derived(ecs.scenes.active);
  const activeSceneData = $derived($activeScene?.store);

  const selectedEntity = $derived($activeScene.entities.selected);
  const selectedEntityData = $derived($selectedEntity?.store);

  let deleteLoading = $state(false);

  const disabled = $derived.by<'added' | 'selected' | 'delete' | null>(() => {
    const isNotSelected = type === 'component' ? !$selectedEntity : !$activeScene;
    if (isNotSelected) return 'selected';

    const isAlreadyAdded =
      type === 'component'
        ? !!$selectedEntityData?.components[handle.id]
        : $activeSceneData.systems.includes(handle.id);
    if (isAlreadyAdded) return 'added';

    if (deleteLoading) return 'delete';

    return null;
  });
  const items: PackageItems = $derived(ITEMS[type]);
  const tooltip = $derived.by(() => {
    if (disabled === 'added') return items.disableAddTooltipAlreadyAdded;
    if (disabled === 'selected') return items.disableAddTooltipNotSelected;
    return items.addTooltip;
  });

  let deleteOpen = $state(false);

  const onAdd = (e: MouseEvent) => {
    e.stopPropagation();
    if (type === 'component') {
      const entity = ecs.scenes.activeData.entities.selectedData;
      if (!entity) return;
      entity.components.add(get(pkg).id);
    } else {
      ecs.scenes.activeData.systems.add(get(pkg).id);
    }
  };

  const onOpenCode = (e: MouseEvent) => {
    e.stopPropagation();
    const item = get(pkg);
    if (type === 'library' || !item.path) return;
    tabsStore.openTab({
      type: getType(item.path),
      title: item.path.split('/').at(-1) ?? item.name ?? item.id,
      metadata: {
        path: item.path,
      },
    });
  };

  const handleDelete = async () => {
    deleteLoading = true;
    await handle.delete();
    deleteLoading = false;
  };

  const onDelete = (e: MouseEvent) => {
    e.stopPropagation();
    deleteOpen = true;
  };
</script>

<DeleteConfirmDialog
  type={capitalize(type)}
  name={$pkg.name ?? $pkg.id}
  bind:open={deleteOpen}
  onConfirm={handleDelete}
/>

<ContextMenu>
  <ContextMenuTrigger>
    <div class="group border-b border-border/50 px-3 py-2 hover:bg-neutral-800 cursor-default">
      <div class="flex justify-between items-center">
        <div>
          <div class="flex items-center gap-2">
            <span class={['w-3.5 h-3.5 shrink-0', items.icon.name, items.icon.color]}></span>
            <span class="font-medium text-foreground flex-1 truncate text-xs">
              {$pkg.name ?? $pkg.path?.split('/').at(-1) ?? $pkg.id}
            </span>
          </div>
          <div class="mt-0.5 text-xs text-muted-foreground truncate pl-5">
            {$pkg.path ?? $pkg.id}
          </div>
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          {#if tooltip}
            <TooltipText text={tooltip}>
              <Button disabled={!!disabled} variant="ghost" size="icon" onclick={onAdd}>
                <span class="i-ic-baseline-add-circle text-green-400"></span>
              </Button>
            </TooltipText>
          {/if}
          <Button
            disabled={type === 'library' || deleteLoading}
            variant="ghost"
            size="icon"
            class="text-destructive hover:text-destructive hover:bg-destructive/20"
            onclick={onDelete}
          >
            {#if deleteLoading}
              <Spinner class="w-3 h-3" />
            {:else}
              <span class="i-ic-baseline-delete"></span>
            {/if}
          </Button>
        </div>
      </div>
    </div>
  </ContextMenuTrigger>
  <ContextMenuContent>
    {#if type !== 'library'}
      <ContextMenuItem onclick={onOpenCode}>
        <span class="i-ic-baseline-open-in-new"></span>
        Open code
      </ContextMenuItem>
      {#if type !== 'asset'}
        <ContextMenuItem disabled={!!disabled} onclick={onAdd}>
          <span class="i-ic-baseline-add-circle text-green-400"></span>
          {items.addTooltip}
        </ContextMenuItem>
      {/if}
      <ContextMenuSeparator />
    {/if}
    <ContextMenuItem
      disabled={type === 'library' || deleteLoading}
      variant="destructive"
      onclick={onDelete}
    >
      {#if deleteLoading}
        <Spinner class="w-3 h-3" />
      {:else}
        <span class="i-ic-baseline-delete"></span>
      {/if}
      Delete
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
