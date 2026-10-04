<script lang="ts">
  import { formatBytes } from '../../network/packets';
  import { LIMITS, throughput } from '../../recorder/recorder';
  import LineChart from '../chart/LineChart.svelte';

  /** The network totals the engine reported, oldest first. */
  const { totals }: { totals: readonly Parameters<typeof throughput>[0][] } = $props();

  const rates = $derived(totals.map(throughput));
  const times = $derived(totals.map((entry) => entry.time));
</script>

<div class="charts">
  {#if totals.length}
    <LineChart
      label="Bytes per second"
      height={72}
      {times}
      slots={LIMITS.network}
      format={formatBytes}
      series={[
        { label: 'In', slot: 1, values: rates.map((rate) => rate.in.bytes) },
        { label: 'Out', slot: 2, values: rates.map((rate) => rate.out.bytes) },
      ]}
    />
    <LineChart
      label="Packets per second"
      height={72}
      {times}
      slots={LIMITS.network}
      format={(value) => String(Math.round(value))}
      series={[
        { label: 'In', slot: 1, values: rates.map((rate) => rate.in.packets) },
        { label: 'Out', slot: 2, values: rates.map((rate) => rate.out.packets) },
      ]}
    />
  {:else}
    <p class="note">This game's engine doesn't report network totals: no throughput charts.</p>
  {/if}
</div>

<style>
  .charts {
    display: grid;
    flex: none;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--nf-space-3);
    padding: var(--nf-space-2);
  }
  .note {
    margin: 0;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
</style>
