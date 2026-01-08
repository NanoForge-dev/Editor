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
    class="bg-neutral-800 w-full py-1 flex gap-1 cursor-pointer items-center px-2 text-sm font-semibold text-neutral-300"
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
        <div class="mb-1 grid grid-cols-[140px_1fr] gap-2 items-center m-2">
          <div class="text-neutral-200 text-sm">{key}</div>

          {#if typeof value === 'string'}
            <input class="bg-neutral-800 rounded-sm px-2 py-0.5 input" type="text" {value} />
          {:else if typeof value === 'number'}
            <input
              class="bg-neutral-800 rounded-sm px-2 py-0.5 input w-32"
              type="number"
              step="0.01"
              {value}
            />
          {:else if typeof value === 'boolean'}
            <label class="flex items-center gap-2">
              <input type="checkbox" checked={value} />
            </label>
          {:else if typeof value === 'object' && value !== null}
            <div class="gap-2 flex">
              {#if 'x' in value}
                <div>
                  <span class="text-red-300 mr-1">x</span>
                  <input
                    class="bg-neutral-800 rounded-sm px-2 py-0.5 input w-24"
                    type="number"
                    value={value.x}
                  />
                </div>
              {/if}
              {#if 'y' in value}
                <div>
                  <span class="text-green-300 mr-1">y</span>
                  <input
                    class="bg-neutral-800 rounded-sm px-2 py-0.5 input w-24"
                    type="number"
                    value={value.y}
                  />
                </div>
              {/if}
              {#if 'z' in value}
                <div>
                  <span class="text-blue-300 mr-1">z</span>
                  <input
                    class="bg-neutral-800 rounded-sm px-2 py-0.5 input w-24"
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
