<script lang="ts">
  import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="flex flex-col gap-1">
  {#each { length: 3 }, i (i)}
    <div class="flex items-center gap-3 px-2 py-2">
      <Skeleton class="size-9 rounded-md shrink-0" />
      <div class="flex flex-col gap-1.5 flex-1 min-w-0">
        <Skeleton class="h-3.5 w-3/4" />
        <Skeleton class="h-3 w-1/2" />
      </div>
    </div>
  {/each}
</div>
