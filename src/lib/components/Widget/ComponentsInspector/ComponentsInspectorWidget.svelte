<script lang="ts">
  import ComponentValueEditor from './ComponentValueEditor.svelte';
  import { components } from '../../demo/components';
</script>

<div class="h-full w-full overflow-y-scroll bg-neutral-900 py-1 text-md">
  {#each components as component (component.type)}
    <ComponentValueEditor {component} />
  {/each}
  <div class="mx-4 my-4 flex justify-center">
    <button
      class="h-10 w-full cursor-pointer rounded-md bg-neutral-800 font-semibold hover:bg-neutral-700"
    >
      Add component
    </button>
  </div>
</div>
