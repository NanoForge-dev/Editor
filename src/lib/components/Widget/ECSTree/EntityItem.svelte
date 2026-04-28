<script lang="ts">
  import type { SaveEntity } from '$lib/loader/client/types/save.type';
  import { selectedEntityId } from './entity-selected.store.svelte';

  interface Props {
    item: SaveEntity;
  }
  let { item }: Props = $props();
</script>

<button
  class="{$selectedEntityId
    ? 'bg-neutral-700'
    : 'hover:bg-neutral-800'} cursor-pointer py-3 flex items-center h-5 text-neutral-200 gap-1"
  style="padding-left: 8px"
  onclick={() => {
    $selectedEntityId = item.id;
  }}
>
  <span class="i-solar-accessibility-linear ml-3"></span>
  <span>{item.id}</span>
</button>
