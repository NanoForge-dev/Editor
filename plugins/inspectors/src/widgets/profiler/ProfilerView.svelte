<script lang="ts">
  import { SettingsServiceToken } from '@nanoforge-dev/editor-sdk';
  import { Button, EmptyState, Icon, type WidgetInstance } from '@nanoforge-dev/editor-sdk/ui';

  import LineChart from '../chart/LineChart.svelte';
  import SourcePicker from '../SourcePicker.svelte';
  import { follow } from '../follow.svelte';
  import { type FrameSample, LIMITS, isSpike, libraryRows } from '../../recorder/recorder';
  import { getRecorder } from '../../session/recorder-session';

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const settings = instance.services.get(SettingsServiceToken);
  // svelte-ignore state_referenced_locally
  const view = follow(getRecorder(), 'profiler', instance.visible);
  const budgetSetting = settings.observe<number>('@nanoforge/inspectors.tickBudgetMs');
  const budget = $derived($budgetSetting ?? 16.7);

  /** While paused, the charts keep the windows they had (the recorder goes on). */
  let frozen = $state<readonly FrameSample[]>();
  let pinned = $state<FrameSample>();
  let hovered = $state<number>();

  const frames = $derived(frozen ?? view.record?.frames ?? []);
  const spikes = $derived(frames.map((sample) => isSpike(sample, budget)));
  const spikeCount = $derived(spikes.filter(Boolean).length);
  const latest = $derived(frames.at(-1));
  const shown = $derived((hovered !== undefined ? frames[hovered] : undefined) ?? pinned ?? latest);
  const pinnedIndex = $derived(pinned ? frames.indexOf(pinned) : -1);
  const libraries = $derived(shown ? libraryRows(shown.stats) : []);

  const pause = () => {
    frozen = [...(view.record?.frames ?? [])];
  };
  const resume = () => {
    frozen = undefined;
    pinned = undefined;
  };
  const pin = (index: number) => {
    if (!frozen) pause();
    pinned = frames[index];
  };

  const ms = (value: number) => `${value < 10 ? value.toFixed(2) : value.toFixed(1)} ms`;
  const time = (value: number) => new Date(value).toLocaleTimeString([], { hour12: false });
</script>

<div class="profiler">
  {#if !frames.length}
    <EmptyState
      icon="activity"
      title="No game is running"
      description="Play the game: tick times, libraries and systems appear here."
    />
  {:else}
    <div class="toolbar">
      <SourcePicker
        sources={view.sources}
        value={view.source ?? 'client'}
        onchange={(source) => {
          view.source = source;
          resume();
        }}
      />
      <span class="stat"><strong>{Math.round(latest?.stats.tps ?? 0)}</strong> ticks/s</span>
      <span class="stat"><strong>{ms(latest?.stats.tick.avg ?? 0)}</strong> average tick</span>
      <span class="stat" class:over={spikeCount > 0}>
        {#if spikeCount}<Icon name="triangle-alert" size={13} />{/if}
        <strong>{spikeCount}</strong>
        {spikeCount === 1 ? 'spike' : 'spikes'} over {ms(budget)}
      </span>
      <span class="grow"></span>
      {#if frozen}
        <span class="paused" role="status"
          >Paused{pinned ? `, window of ${time(pinned.time)}` : ''}</span
        >
        <Button size="sm" icon="play" onclick={resume}>Resume</Button>
      {:else}
        <Button size="sm" icon="pause" onclick={pause}>Pause</Button>
      {/if}
    </div>
    <div class="charts">
      <LineChart
        label="Tick time"
        times={frames.map((sample) => sample.time)}
        slots={LIMITS.frames}
        format={(value) => `${value >= 10 ? Math.round(value) : value.toFixed(1)} ms`}
        series={[
          { label: 'Average', slot: 1, values: frames.map((sample) => sample.stats.tick.avg) },
          { label: 'Slowest', slot: 2, values: frames.map((sample) => sample.stats.tick.max) },
        ]}
        budget={{ value: budget, label: `Budget ${ms(budget)}` }}
        marks={spikes}
        marksLabel="Over the budget"
        selected={pinnedIndex >= 0 ? pinnedIndex : undefined}
        onhover={(index) => (hovered = index)}
        onpick={pin}
      />
      <LineChart
        label="Ticks per second"
        height={56}
        times={frames.map((sample) => sample.time)}
        slots={LIMITS.frames}
        format={(value) => String(Math.round(value))}
        series={[{ label: 'Ticks per second', slot: 1, values: frames.map((s) => s.stats.tps) }]}
        selected={pinnedIndex >= 0 ? pinnedIndex : undefined}
        onhover={(index) => (hovered = index)}
        onpick={pin}
      />
    </div>
    {#if shown}
      <div class="tables">
        <table aria-label="Libraries">
          <caption>Libraries, window of {time(shown.time)}</caption>
          <thead>
            <tr><th>Library</th><th>Average</th><th>Slowest</th><th>Share of the tick</th></tr>
          </thead>
          <tbody>
            {#each libraries as row (row.name)}
              <tr>
                <th scope="row">{row.name}</th>
                <td>{ms(row.avg)}</td>
                <td>{ms(row.max)}</td>
                <td>
                  <span class="bar" style:width={`${Math.round(row.share * 60)}px`}></span>
                  {Math.round(row.share * 100)}%
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        <table aria-label="Systems">
          <caption>Systems, in run order</caption>
          <thead>
            <tr><th>System</th><th>Average</th><th>Slowest</th><th>Calls</th></tr>
          </thead>
          <tbody>
            {#each shown.systems?.systems ?? [] as system (system.index)}
              <tr class:idle={!system.calls}>
                <th scope="row">{system.name}</th>
                <td>{ms(system.avg)}</td>
                <td>{ms(system.max)}</td>
                <td>{system.calls}</td>
              </tr>
            {:else}
              <tr>
                <td colspan="4" class="none">
                  This game's engine doesn't report system timings (it needs an ECS library that
                  does).
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>

<style>
  .profiler {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: auto;
  }
  .toolbar {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: var(--nf-space-3);
    align-items: center;
    padding: var(--nf-space-1) var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
    font-size: var(--nf-font-size-sm);
  }
  .stat {
    display: inline-flex;
    gap: var(--nf-space-1);
    align-items: center;
    color: var(--nf-color-text-muted);
  }
  .stat strong {
    color: var(--nf-color-text);
    font-variant-numeric: tabular-nums;
  }
  .stat.over :global(svg) {
    color: var(--nf-color-warning);
  }
  .grow {
    flex: 1;
  }
  .paused {
    color: var(--nf-color-text-muted);
  }
  .charts {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: var(--nf-space-2);
    padding: var(--nf-space-2);
  }
  .tables {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--nf-space-4);
    padding: 0 var(--nf-space-2) var(--nf-space-2);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--nf-font-size-sm);
  }
  caption {
    padding-bottom: var(--nf-space-1);
    color: var(--nf-color-text-muted);
    text-align: left;
  }
  th,
  td {
    padding: 2px var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
    text-align: right;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }
  thead th {
    color: var(--nf-color-text-faint);
  }
  th:first-child {
    text-align: left;
  }
  tr.idle {
    color: var(--nf-color-text-faint);
  }
  .none {
    color: var(--nf-color-text-muted);
    text-align: left;
  }
  .bar {
    display: inline-block;
    height: 6px;
    margin-right: var(--nf-space-1);
    border-radius: 0 3px 3px 0;
    background: light-dark(#2a78d6, #3987e5);
    vertical-align: middle;
  }
</style>
