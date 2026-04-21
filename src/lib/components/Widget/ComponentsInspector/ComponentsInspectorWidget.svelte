<script lang="ts">
  import ComponentValueEditor from './ComponentValueEditor.svelte';
  import { componentsManifests, save } from '$lib/components/Widget/EditorGame/game.svelte';
  import { localApi } from '$lib/components/Utils/api/api';

  let loaded = false;
  let loading = $state(true);

  $effect(() => {
    if ($save?.components?.length && !loaded) {
      loaded = true;
      loadManifests();
    }
  });
  async function loadManifests() {
    $componentsManifests = [];

    $componentsManifests = await Promise.all(
      $save.components.map((component) => {
        return localApi.getComponentManifest(component.path, 'client');
      }),
    );

    loading = false;
  }
</script>

<div class="h-full w-full overflow-y-scroll bg-neutral-900 py-1 text-md">
  {#if !loading}
    {#each $save.entities as entity (entity.id)}
      <ComponentValueEditor {entity} />
    {/each}
  {/if}
  <div class="mx-4 my-4 flex justify-center">
    <button
      class="h-10 w-full cursor-pointer rounded-md bg-neutral-800 font-semibold hover:bg-neutral-700"
      onclick={() => {}}
    >
      Add component
    </button>
  </div>
</div>
