<script lang="ts">
  import { createDefaultComponent } from '$lib/components/Widget/EntityInspector/component-creator';
  import { selectedEntityId } from '$lib/components/Widget/ECSTree/entity-selected.store.svelte';
  import ComponentSelector from '$lib/components/Widget/EntityInspector/ComponentSelector.svelte';
  import type { SaveEntity } from '@utils/types';
  import { CoreEvents } from '$lib/client/event';
  import { useProject } from '$lib/client/project';
  import { Input } from '$lib/components/ui/input';
  import { TristateSwitch } from '$lib/components/ui/tristate-switch';

  let openMap: { [key: string]: boolean } = $state({});
  let selectedEntity: SaveEntity | undefined = $state(undefined);
  let openComponentSelector: boolean = $state(false);

  const { event, packages, save } = useProject();

  $effect(() => {
    if ($selectedEntityId) {
      selectedEntity = save.save.entities.find((e) => e.id === $selectedEntityId);
    }
  });

  async function addComponent(componentName: string) {
    const [name, params] = await createDefaultComponent(componentName);
    if (selectedEntity) {
      selectedEntity.components[name] = params;
    }
  }

  async function removeComponent(componentName: string) {
    if (!selectedEntity) return;
    // eslint-disable-next-line  @typescript-eslint/no-dynamic-delete
    delete selectedEntity.components[componentName];
  }
</script>

<div class="h-full w-full overflow-y-scroll bg-neutral-900 py-1 text-md">
  {#if selectedEntity}
    <div class="mb-1">
      <div
        class="w-full flex items-center bg-neutral-800 px-2 py-1 font-semibold text-neutral-300 text-lg"
      >
        {selectedEntity.id}
      </div>

      <div class="my-2">
        {#each Object.entries(selectedEntity.components) as [componentName, componentParams] (componentName)}
          <button
            class="text-neutral-200 text-md px-4 w-full flex cursor-pointer items-center gap-1 bg-neutral-800 px-2 py-1 font-semibold text-neutral-300 text-sm"
            onclick={() => (openMap[componentName] = !openMap[componentName])}
          >
            <span
              aria-hidden="true"
              class="{!openMap[componentName]
                ? 'i-solar-alt-arrow-down-bold'
                : 'i-solar-alt-arrow-right-bold'}
            w-4 text-center select-none text-neutral-400 hover:text-neutral-200"
            ></span>
            <span class="i-ic-baseline-token text-neutral-400"></span>
            {componentName}
            <span
              class="i-solar-trash-bin-minimalistic-linear text-red-500 text-align-end"
              aria-hidden="true"
              onclick={(e) => {
                e.stopPropagation();
                removeComponent(componentName);
              }}
            ></span>
          </button>
          {#if !openMap[componentName]}
            {#each packages.getComponentManifest(componentName)?.params as param (param.name)}
              <div class="grid grid-cols-[140px_1fr] m-2 mb-1 items-center gap-2">
                <div class="text-neutral-200 text-sm">{param.name}</div>

                {#if param.type === 'string'}
                  <Input
                    type="text"
                    bind:value={componentParams[param.name]}
                    onchange={() => event.emit(CoreEvents.HOT_RELOAD)}
                  />
                {:else if param.type === 'number'}
                  <Input
                    type="number"
                    bind:value={componentParams[param.name]}
                    onchange={() => event.emit(CoreEvents.HOT_RELOAD)}
                  />
                {:else if param.type === 'boolean'}
                  <TristateSwitch
                    bind:value={componentParams[param.name]}
                    onChange={() => {
                      event.emit(CoreEvents.HOT_RELOAD);
                    }}
                  />
                {/if}
              </div>
            {/each}
          {/if}
        {/each}
      </div>
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
        (c) => !Object.keys(selectedEntity?.components ?? {}).includes(c.name),
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
</div>

<style>
  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type='number'] {
    -moz-appearance: textfield;
  }
</style>
