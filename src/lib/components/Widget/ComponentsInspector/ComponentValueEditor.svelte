<script lang="ts">
  import type { SaveEntity } from '$lib/loader/client/types/save.type';
  import { componentsManifests } from '$lib/components/Widget/EditorGame/game.svelte';

  interface Props {
    entity: SaveEntity;
  }
  let { entity = $bindable() }: Props = $props();

  let open: boolean = $state(true);
</script>

<div class="mb-1">
  <button
    class="w-full flex cursor-pointer items-center gap-1 bg-neutral-800 px-2 py-1 font-semibold text-neutral-300 text-sm"
    onclick={() => (open = !open)}
  >
    <span
      aria-hidden="true"
      class="{open ? 'i-solar-alt-arrow-down-bold' : 'i-solar-alt-arrow-right-bold'}
            w-4 text-center select-none text-neutral-400 hover:text-neutral-200"
    ></span>
    {entity.id}
  </button>

  {#if open}
    <div class="my-2">
      {#each Object.entries(entity.components) as [componentName, componentParams] (componentName)}
        <div class="text-neutral-200 text-sm">{componentName}</div>
        {#each $componentsManifests.find((manComp) => manComp.name === componentName)?.params as param (param.name)}
          <div class="grid grid-cols-[140px_1fr] m-2 mb-1 items-center gap-2">
            <div class="text-neutral-200 text-sm">{param.name}</div>

            {#if param.type === 'string'}
              <input
                class="input rounded-sm bg-neutral-800 px-2 py-0.5"
                type="text"
                bind:value={componentParams[param.name]}
              />
            {:else if param.type === 'number'}
              <input
                class="input w-28 rounded-sm bg-neutral-800 px-2 py-0.5"
                type="number"
                bind:value={componentParams[param.name]}
              />
            {:else if param.type === 'boolean'}
              <label class="flex items-center gap-2">
                <input type="checkbox" bind:checked={componentParams[param.name]} />
              </label>
            {/if}
          </div>
        {/each}
      {/each}
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
