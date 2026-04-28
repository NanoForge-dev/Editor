<script lang="ts">
  import EntityItem from './EntityItem.svelte';

  import { fetchComponentsManifests, save } from '$lib/components/Widget/EditorGame/game.svelte';

  let loaded = false;
  let loading = $state(true);

  $effect(() => {
    if ($save?.components?.length && !loaded) {
      loaded = true;
      fetchComponentsManifests('client').then(() => {
        loading = false;
      });
    }
  });
</script>

<div class="h-full w-full flex flex-col bg-neutral-800">
  {#if !loading}
    <div class="flex justify-between p-2">
      <input
        class="h-7 rounded-md bg-black p-2 text-sm outline outline-1 outline-neutral-700"
        placeholder="Search entity"
      />
      <button
        class="w-fit flex cursor-pointer items-center gap-1 rounded-md bg-neutral-700 px-2 py-1 text-neutral-200 text-sm text-sm hover:bg-neutral-600"
      >
        <span class="i-ic-baseline-add"></span>
        Add Entity
      </button>
    </div>
    <span class="text-xl px-3 py-1"> Entities </span>
    <div class="h-full flex flex-col bg-neutral-900 p-1">
      {#each $save.entities as entity (entity.id)}
        <EntityItem item={entity} />
      {/each}
    </div>
  {/if}
</div>
