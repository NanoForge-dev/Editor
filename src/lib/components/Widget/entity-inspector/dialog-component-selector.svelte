<script lang="ts">
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
  } from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import type { Component, SceneEntityHandle } from '$lib/client/ecs';
  import { useProject } from '$lib/client/project';

  interface Props {
    open: boolean;
    handle: SceneEntityHandle;
    onSelect: (component: Component) => unknown;
  }

  let { open = $bindable(false), handle, onSelect }: Props = $props();

  const { ecs } = useProject();

  const entity = $derived(handle.store);
  const components = $derived(ecs.components.store);

  const availableComponents = $derived(
    $components
      .filter((c) => !Object.keys($entity.components).includes(c.id))
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  let search = $state('');

  const close = () => {
    search = '';
    open = false;
  };

  const handleSelect = (component: Component) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(component);
    close();
  };
</script>

<Dialog bind:open>
  <DialogContent class="sm:max-w-lg min-h-100 max-h-80vh md:max-h-60vh flex flex-col">
    <DialogHeader>
      <DialogTitle>Add component</DialogTitle>
      <DialogDescription>Select a component to add to {$entity.name}</DialogDescription>
    </DialogHeader>

    <Input
      class="w-full mb-3 px-3 py-2 rounded"
      placeholder="Search component..."
      bind:value={search}
    />

    <div class="flex flex-col overflow-y-scroll">
      {#if availableComponents.length === 0}
        <div class="text-neutral-400 text-sm px-2 py-1">No component found</div>
      {:else}
        {#each availableComponents as component (component.name)}
          <button
            class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-neutral-800 text-neutral-200 text-base cursor-pointer"
            onclick={handleSelect(component)}
          >
            <span class="i-ic-baseline-token text-neutral-400 text-lg"></span>
            {component.name}
          </button>
        {/each}
      {/if}
    </div>
  </DialogContent>
</Dialog>
