<script lang="ts">
  import DialogComponentSelector from '$lib/components/Widget/entity-inspector/dialog-component-selector.svelte';
  import { useProject } from '$lib/client/project';

  import ComponentList from './component-list.svelte';
  import { Button } from '$lib/components/ui/button';
  import type { Component } from '$lib/client/ecs';

  let openComponentSelector: boolean = $state(false);

  const { save, ecs } = useProject();

  const activeScene = $derived(ecs.scenes.active);
  const entity = $derived($activeScene.entities.selected);

  const handleSelect = (component: Component) => {
    if (!$entity) throw new Error("Can't create component: no entity selected");
    $entity.components.add(component.id);
    void save.forceSyncToServer();
  };
</script>

<div class="h-full w-full overflow-y-scroll bg-neutral-900 py-1 text-md">
  {#if $entity}
    <div class="mb-1">
      <div
        class="w-full flex items-center bg-neutral-800 px-2 py-1 font-semibold text-neutral-300 text-lg"
      >
        {$entity.id}
        <span class="i-ic-round-refresh ml-auto text-2xl cursor-pointer"></span>
      </div>
      <ComponentList manager={$entity.components} />
    </div>
    <div class="mx-4 my-4 flex justify-center">
      <Button
        variant="secondary"
        class="h-10 w-full cursor-pointer rounded-md gap-2 "
        onclick={() => {
          openComponentSelector = true;
        }}
      >
        <span class="i-solar-add-circle-bold"> </span>
        Add component
      </Button>
    </div>
    <DialogComponentSelector
      handle={$entity}
      bind:open={openComponentSelector}
      onSelect={handleSelect}
    />
  {:else}
    <div class="h-full w-full flex items-center justify-center text-2xl text-align-center">
      Select an entity in the left panel
    </div>
  {/if}
</div>
