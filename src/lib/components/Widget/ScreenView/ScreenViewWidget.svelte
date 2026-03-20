<script lang="ts">
  import api from '$lib/components/Utils/api/api';
</script>

<div class="h-full w-full bg-neutral-800 flex flex-col">
  <div class="py-2 px-2">
    <button
      aria-label="uploadFiles"
      onclick={() => api.uploadFiles()}
      class="py-1 w-full h-full rounded-md text-sm hover:bg-neutral-900 cursor-pointer"
    >
      <span class="i-ic-baseline-upload w-full h-full"></span>
    </button>
  </div>
  <div class="h-full w-full bg-black mb-8"></div>
</div>
