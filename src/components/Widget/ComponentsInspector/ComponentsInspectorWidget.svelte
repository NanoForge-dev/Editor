<script lang="ts">
  import ComponentValueEditor from './ComponentValueEditor.svelte';
  import { components } from '../../demo/components';
</script>

<div class="bg-neutral-900 h-full w-full text-md py-1 overflow-y-scroll">
  {#each components as component (component.type)}
    <ComponentValueEditor {component} />
  {/each}
  <div class="flex mx-4 my-4 justify-center">
    <button
      class="cursor-pointer bg-neutral-800 hover:bg-neutral-700 w-full h-10 font-semibold rounded-md"
    >
      Add component
    </button>
  </div>
</div>
