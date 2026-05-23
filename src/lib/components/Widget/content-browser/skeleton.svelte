<div class="h-full w-full flex gap-1 bg-neutral-800 p-1">
  <div class="w-1/5 flex flex-col gap-1 rounded-l-md rounded-r-sm bg-neutral-900 p-1">
    {#each { length: 6 }, i (i)}
      <div class="h-7 w-full animate-pulse rounded bg-neutral-800"></div>
    {/each}
  </div>
  <div class="h-full w-4/5 flex flex-col">
    <div class="h-fit flex items-center gap-2 px-1 pb-2 pt-1">
      <div class="h-6 w-16 animate-pulse rounded-lg bg-neutral-700"></div>
      <div class="h-6 w-20 animate-pulse rounded-lg bg-neutral-700"></div>
    </div>
    <div class="h-full rounded-l-sm rounded-r-md bg-neutral-900 overflow-hidden">
      <div class="h-full w-full flex flex-wrap content-start items-start gap-2 overflow-y-auto p-2">
        {#each { length: 12 }, i (i)}
          <div class="h-32 w-24 flex flex-col items-center gap-2 rounded-md p-1">
            <div class="w-full aspect-square animate-pulse rounded bg-neutral-800"></div>
            <div class="h-3 w-3/4 animate-pulse rounded bg-neutral-800"></div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
