<script lang="ts">
  import ComponentValueEditor from './ComponentValueEditor.svelte';
  import { componentsManifests, gameProps } from '$lib/loader/client/game.svelte';
  import { onMount } from 'svelte';
  import { fetchComponentManifest } from '$lib/loader/client/componentManifest';
  import { fetchSave } from '$lib/loader/client/save';

  onMount(async () => {
    await fetchSave();
    componentsManifests.length = 0;
    componentsManifests.push(
      ...(await Promise.all(
        gameProps.save.components.map((component) => {
          return fetchComponentManifest(component.path);
        }),
      )),
    );
  });
</script>

<div class="h-full w-full overflow-y-scroll bg-neutral-900 py-1 text-md">
  {#each gameProps.save.entities as entity (entity.id)}
    <ComponentValueEditor {entity} />
  {/each}
  <div class="mx-4 my-4 flex justify-center">
    <button
      class="h-10 w-full cursor-pointer rounded-md bg-neutral-800 font-semibold hover:bg-neutral-700"
      on:click={() => {}}
    >
      Add component
    </button>
  </div>
</div>
