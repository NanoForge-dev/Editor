<script lang="ts">
  import type { Entity } from '../../Entity/types';
  import Self from './EntityItem.svelte';

  interface Props {
    item: Entity;
    deepness?: number;
    select: (id: string) => void;
    selected: string[];
  }
  let { item, deepness = 0, select, selected = $bindable() }: Props = $props();

  let open: boolean = $state(true);

  function toggle() {
    if (item.children) open = !open;
  }
</script>

<button
  class="{selected.find((s) => s === item.id)
    ? 'bg-neutral-700'
    : 'hover:bg-neutral-800'} cursor-pointer py-3 flex items-center h-5 text-sm text-neutral-200 gap-1"
  style={`padding-left: ${deepness * 8}px`}
  onclick={item.type === 'entity' ? () => select(item.id) : toggle}
>
  {#if item.type === 'folder'}
    <span
      aria-hidden="true"
      class="{open
        ? 'i-solar-alt-arrow-down-bold'
        : 'i-solar-alt-arrow-right-bold'} w-4 text-center select-none text-neutral-400 hover:text-neutral-200"
    ></span>
    <span class="i-ic-baseline-folder"></span>
  {:else}
    <span class="i-ic-baseline-token ml-3"></span>
  {/if}

  <span>{item.name}</span>
</button>
{#if item.type === 'folder' && open}
  {#each item.children as children (children.id)}
    <Self item={children} deepness={deepness + 1} {select} bind:selected />
  {/each}
{/if}
