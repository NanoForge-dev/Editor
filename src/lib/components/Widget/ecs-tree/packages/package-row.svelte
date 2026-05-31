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
  import { SYSTEM_ITEMS } from '../systems/system.items';
  import { DeleteConfirmDialog } from '$lib/components/dialogs';
  import { capitalize } from '@utils/string';
  import type { ComponentHandle, SystemHandle } from '$lib/client/ecs';
  import { useProject } from '$lib/client/project';
  import { get } from 'svelte/store';

  type Props =
    | {
        type: 'component';
        handle: ComponentHandle;
      }
    | {
        type: 'system';
        handle: SystemHandle;
      };

  const ITEMS = { component: COMPONENT_ITEMS, system: SYSTEM_ITEMS };

  const { type, handle }: Props = $props();
  const { ecs } = useProject();

  const pkg = $derived(handle.store);

  let deleteOpen = $state(false);

  const items: PackageItems = $derived(ITEMS[type]);

  const onAdd = () => {
    if (type === 'component') {
      const entity = ecs.scenes.active.entities.selected;
      if (!entity) return;
      entity.components.add(get(pkg).id);
    } else {
      ecs.scenes.active.systems.add(get(pkg).id);
    }
  };

  const onOpen = () => {
    // @todo handle open code edito
  };

  const handleDelete = () => {
    // @todo delete package
    handle.delete();
  };

  const onDelete = () => {
    deleteOpen = true;
  };
</script>

<DeleteConfirmDialog
  type={capitalize(type)}
  name={$pkg.name}
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
          <div class="mt-0.5 text-xs text-muted-foreground truncate pl-5">{$pkg.path}</div>
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <TooltipText text={items.addTooltip}>
            <Button variant="ghost" size="icon" onclick={onAdd}>
              <span class="i-ic-baseline-add-circle text-green-400"></span>
            </Button>
          </TooltipText>
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
    <ContextMenuItem onclick={onOpen}>
      <span class="i-ic-baseline-open-in-new"></span>
      Open code
    </ContextMenuItem>
    <ContextMenuItem onclick={onAdd}>
      <span class="i-ic-baseline-add-circle text-green-400"></span>
      {items.addTooltip}
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem variant="destructive" onclick={onDelete}>
      <span class="i-ic-baseline-delete"></span>
      Delete
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
