<script lang="ts">
  import type { Component } from '../../Entity/Components/types';

  interface Props {
    component: Component;
  }
  let { component }: Props = $props();

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
    {component.type}
  </button>

  {#if open}
    <div class="my-2">
      {#each Object.entries(component.values) as [key, value] (key)}
        <div class="grid grid-cols-[140px_1fr] m-2 mb-1 items-center gap-2">
          <div class="text-neutral-200 text-sm">{key}</div>

          {#if typeof value === 'string'}
            <input class="input rounded-sm bg-neutral-800 px-2 py-0.5" type="text" {value} />
          {:else if typeof value === 'number'}
            <input
              class="input w-28 rounded-sm bg-neutral-800 px-2 py-0.5"
              type="number"
              step="0.01"
              {value}
            />
          {:else if typeof value === 'boolean'}
            <label class="flex items-center gap-2">
              <input type="checkbox" checked={value} />
            </label>
          {:else if typeof value === 'object' && value !== null}
            <div class="flex gap-2">
              {#if 'x' in value}
                <div>
                  <span class="mr-1 text-red-300">x</span>
                  <input
                    class="input w-24 rounded-sm bg-neutral-800 px-2 py-0.5"
                    type="number"
                    value={value.x}
                  />
                </div>
              {/if}
              {#if 'y' in value}
                <div>
                  <span class="mr-1 text-green-300">y</span>
                  <input
                    class="input w-24 rounded-sm bg-neutral-800 px-2 py-0.5"
                    type="number"
                    value={value.y}
                  />
                </div>
              {/if}
              {#if 'z' in value}
                <div>
                  <span class="mr-1 text-blue-300">z</span>
                  <input
                    class="input w-24 rounded-sm bg-neutral-800 px-2 py-0.5"
                    type="number"
                    value={value.z}
                  />
                </div>
              {/if}
            </div>
          {/if}
        </div>
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
