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
  import { type PackageItems } from '../types';
  import { COMPONENT_ITEMS } from '../components/component.items';
  import { LIBRARY_ITEMS } from '../libraries/library.items';
  import { SYSTEM_ITEMS } from '../systems/system.items';
  import type { Package } from '../types';
  import { DeleteConfirmDialog } from '$lib/components/dialogs';
  import { capitalize } from '@utils/string';
  import type { ComponentHandle, SystemHandle, LibraryHandle } from '$lib/client/ecs';
  import { useProject } from '$lib/client/project';
  import { get, type Writable } from 'svelte/store';

  type Props =
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

  const ITEMS = { component: COMPONENT_ITEMS, system: SYSTEM_ITEMS, library: LIBRARY_ITEMS };

  const { type, handle }: Props = $props();
  const { ecs } = useProject();

  const pkg = $derived<Writable<Package>>(handle.store);

  const activeScene = $derived(ecs.scenes.active);
  const activeSceneData = $derived($activeScene?.store);

  const selectedEntity = $derived($activeScene.entities.selected);
  const selectedEntityData = $derived($selectedEntity?.store);

  const disabled = $derived.by<'added' | 'selected' | null>(() => {
    const isNotSelected = type === 'component' ? !$selectedEntity : !$activeScene;
    if (isNotSelected) return 'selected';

    const isAlreadyAdded =
      type === 'component'
        ? !!$selectedEntityData?.components[handle.id]
        : $activeSceneData.systems.includes(handle.id);
    if (isAlreadyAdded) return 'added';

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
    // @todo handle open code editor
  };

  const handleDelete = () => {
    // @todo delete package
    handle.delete();
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
            <span class="font-medium text-foreground flex-1 truncate text-xs">{$pkg.name}</span>
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
            variant="ghost"
            size="icon"
            class="text-destructive hover:text-destructive hover:bg-destructive/20"
            onclick={onDelete}
          >
            <span class="i-ic-baseline-delete"></span>
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
      <ContextMenuItem disabled={!!disabled} onclick={onAdd}>
        <span class="i-ic-baseline-add-circle text-green-400"></span>
        {items.addTooltip}
      </ContextMenuItem>
      <ContextMenuSeparator />
    {/if}
    <ContextMenuItem variant="destructive" onclick={onDelete}>
      <span class="i-ic-baseline-delete"></span>
      Delete
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
