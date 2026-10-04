<script lang="ts">
  import type { RuntimeService } from '@nanoforge-dev/editor-sdk';

  const { runtime }: { runtime: RuntimeService } = $props();
  // svelte-ignore state_referenced_locally
  const stats = runtime.frameStats;

  $effect(() => {
    const request = runtime.useFeatures({ frameStats: { intervalMs: 500 } });
    return () => request.dispose();
  });

  let heap = $state<number>();
  $effect(() => {
    const memory = () =>
      (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const timer = setInterval(() => (heap = memory()?.usedJSHeapSize), 1000);
    heap = memory()?.usedJSHeapSize;
    return () => clearInterval(timer);
  });

  const ms = (value: number) => `${value.toFixed(value < 10 ? 2 : 1)} ms`;
</script>

<div class="stats" role="status" aria-label="Game stats">
  {#each [...$stats].sort(([a], [b]) => a.localeCompare(b)) as [source, frame] (source)}
    {@const slowest = Object.entries(frame.libraries)
      .sort(([, a], [, b]) => b.avg - a.avg)
      .slice(0, 3)}
    <section>
      <h4>{source}</h4>
      <p>
        <strong>{Math.round(frame.tps)}</strong> tps · tick {ms(frame.tick.avg)} (max {ms(
          frame.tick.max,
        )})
      </p>
      {#each slowest as [library, timing] (library)}
        <p class="library">{library} {ms(timing.avg)}</p>
      {/each}
    </section>
  {:else}
    <p>Waiting for frame stats…</p>
  {/each}
  {#if heap}<p class="heap">JS heap {(heap / 1024 / 1024).toFixed(0)} MB</p>{/if}
</div>

<style>
  .stats {
    position: absolute;
    top: var(--nf-space-2);
    left: var(--nf-space-2);
    min-width: 180px;
    padding: var(--nf-space-2);
    border-radius: var(--nf-radius-control);
    background: rgb(0 0 0 / 70%);
    color: #e8e8f0;
    font-family: var(--nf-font-code);
    font-size: 11px;
    line-height: 1.5;
    pointer-events: none;
  }
  section + section {
    margin-top: var(--nf-space-1);
  }
  h4 {
    margin: 0;
    color: #a78bfa;
    font-size: 11px;
    text-transform: capitalize;
  }
  p {
    margin: 0;
  }
  .library,
  .heap {
    color: #b4b4c4;
  }
</style>
