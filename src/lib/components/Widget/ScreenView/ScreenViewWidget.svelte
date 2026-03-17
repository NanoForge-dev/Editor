<script lang="ts">
  import { pushLocalProject } from '$lib/components/Utils/Storage/projectSync.js';
</script>

<div class="h-full w-full bg-neutral-800 flex flex-col">
  <div class="py-2 px-2">
    <button
      onclick={pushLocalProject}
      class="bg-green-900 w-24 py-1 rounded-md text-sm text-green-200"
    >
      Update
    </button>
  </div>
  <div class="h-full w-full bg-black mb-8"></div>
</div>
