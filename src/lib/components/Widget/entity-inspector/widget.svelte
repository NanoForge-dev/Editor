<script lang="ts">
  import ComponentSelector from '$lib/components/Widget/entity-inspector/ComponentSelector.svelte';
  import { CoreEvents } from '$lib/client/event';
  import { useProject } from '$lib/client/project';

  import ComponentList from './component-list.svelte';

  let openComponentSelector: boolean = $state(false);
  let refresh: number = $state(0);

  const { event, packages, save, ecs } = useProject();

  const activeScene = $derived(ecs.scenes.active);
  const entity = $derived($activeScene.entities.selected);

  $effect(() => {
    console.log('entity changed');
    $entity?.manager.store.subscribe(() => {
      event.emit(CoreEvents.HOT_RELOAD);
    });
  });

  async function addComponent(componentName: string) {
    const componentManifest = packages.getComponentManifest(componentName);
    if (!componentManifest) {
      throw new Error(`Can't create ${componentName}: manifest not found`);
    }
    if (!$entity) throw new Error("Can't create component: no entity selected");
    save.addComponentToEntity($entity.id, componentName, componentManifest);
    await save.forceSyncToServer();
    refresh++;
  }
</script>

<div class="h-full w-full overflow-y-scroll bg-neutral-900 py-1 text-md">
  {#key refresh}
    {#if $entity}
      <div class="mb-1">
        <div
          class="w-full flex items-center bg-neutral-800 px-2 py-1 font-semibold text-neutral-300 text-lg"
        >
          {$entity.id}
          <span
            class="i-ic-round-refresh ml-auto text-2xl cursor-pointer"
            aria-hidden="true"
            onclick={(e) => {
              e.stopPropagation();
              refresh++;
            }}
          ></span>
        </div>
        <ComponentList manager={$entity.components} />
      </div>
      <div class="mx-4 my-4 flex justify-center">
        <button
          class="h-10 w-full cursor-pointer rounded-md gap-2 bg-neutral-800 font-semibold hover:bg-neutral-700"
          onclick={() => {
            openComponentSelector = true;
          }}
        >
          <span class="i-solar-add-circle-bold text-lg"> </span>
          Add component
        </button>
      </div>
      <ComponentSelector
        availableComponents={save.save.components.filter(
          (c) => !Object.keys($entity?.components ?? {}).includes(c.name),
        )}
        open={openComponentSelector}
        onClose={() => (openComponentSelector = false)}
        onSelect={(c) => {
          addComponent(c.name);
          openComponentSelector = false;
        }}
      />
    {:else}
      <div class="h-full w-full flex items-center justify-center text-2xl text-align-center">
        Select an entity in the left panel
      </div>
    {/if}
  {/key}
</div>
