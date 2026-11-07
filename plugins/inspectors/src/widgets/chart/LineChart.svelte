<script lang="ts">
  import { indexAt, linePath, niceMax } from './chart-scale';

  interface Series {
    readonly label: string;
    /** 1 or 2: the chart palette's slot. */
    readonly slot: 1 | 2;
    readonly values: readonly number[];
  }

  interface Props {
    /** What the chart shows, for assistive technology and the tooltip. */
    label: string;
    series: readonly Series[];
    /** Time of each value (ms since epoch). */
    times: readonly number[];
    /** Values the x axis has room for: the newest is at the right edge. */
    slots: number;
    format: (value: number) => string;
    height?: number;
    /** A horizontal reference line. */
    budget?: { value: number; label: string };
    /** Values to mark above the plot (spikes). */
    marks?: readonly boolean[];
    marksLabel?: string;
    /** Index shown as selected (a pinned window). */
    selected?: number | undefined;
    onhover?: (index: number | undefined) => void;
    onpick?: (index: number) => void;
  }

  const {
    label,
    series,
    times,
    slots,
    format,
    height = 120,
    budget,
    marks,
    marksLabel = 'Spike',
    selected,
    onhover,
    onpick,
  }: Props = $props();

  const MARGIN = { top: 12, right: 8, bottom: 4, left: 44 };
  let width = $state(0);
  let hovered = $state<number>();

  const plotWidth = $derived(Math.max(width - MARGIN.left - MARGIN.right, 0));
  const plotHeight = $derived(height - MARGIN.top - MARGIN.bottom);
  const count = $derived(times.length);
  const max = $derived(
    niceMax(Math.max(budget?.value ?? 0, ...series.flatMap((entry) => entry.values), 0)),
  );
  const ticks = $derived([0, max / 2, max]);
  const y = (value: number) => plotHeight - (Math.min(value, max) / max) * plotHeight;
  const x = (index: number) =>
    slots > 1 ? ((slots - count + index) * plotWidth) / (slots - 1) : plotWidth;
  const focus = $derived(hovered ?? selected);
  const time = (value: number) => new Date(value).toLocaleTimeString([], { hour12: false });

  const move = (event: PointerEvent) => {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    hovered = indexAt(event.clientX - box.left, plotWidth, count, slots);
    onhover?.(hovered);
  };
  const leave = () => {
    hovered = undefined;
    onhover?.(undefined);
  };
  const onkeydown = (event: KeyboardEvent) => {
    if (!count || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const from = focus ?? count - 1;
    const next = Math.min(Math.max(from + (event.key === 'ArrowLeft' ? -1 : 1), 0), count - 1);
    onpick?.(next);
  };
</script>

<figure class="chart" aria-label={label}>
  <figcaption class="legend">
    <span class="title">{label}</span>
    {#if series.length > 1}
      {#each series as entry (entry.label)}
        <span><i class="swatch slot-{entry.slot}"></i>{entry.label}</span>
      {/each}
    {/if}
    {#if budget}<span><i class="swatch budget"></i>{budget.label}</span>{/if}
  </figcaption>
  <div class="plot" bind:clientWidth={width} style:height={`${height}px`}>
    {#if width > 0}
      <svg {width} {height} role="img" aria-label={label}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {#each ticks as tick (tick)}
            <line class="grid" x1="0" x2={plotWidth} y1={y(tick)} y2={y(tick)} />
            <text class="axis" x="-6" y={y(tick)} dy="0.32em" text-anchor="end">{format(tick)}</text
            >
          {/each}
          {#if budget}
            <line class="budget" x1="0" x2={plotWidth} y1={y(budget.value)} y2={y(budget.value)} />
          {/if}
          {#each series as entry (entry.label)}
            <path
              class="line slot-{entry.slot}"
              d={linePath(entry.values, plotWidth, plotHeight, max, slots)}
            />
          {/each}
          {#each marks ?? [] as marked, index (index)}
            {#if marked}
              <path class="mark" transform={`translate(${x(index)},-10)`} d="M-4,0L4,0L0,7Z">
                <title>{marksLabel}</title>
              </path>
            {/if}
          {/each}
          {#if focus !== undefined && focus < count}
            <line class="crosshair" x1={x(focus)} x2={x(focus)} y1="0" y2={plotHeight} />
            {#each series as entry (entry.label)}
              <circle
                class="dot slot-{entry.slot}"
                cx={x(focus)}
                cy={y(entry.values[focus] ?? 0)}
                r="4"
              />
            {/each}
          {/if}
          <rect
            class="hit"
            width={plotWidth}
            height={plotHeight}
            role="slider"
            tabindex="0"
            aria-label={`${label}: pick a window`}
            aria-valuemin="0"
            aria-valuemax={Math.max(count - 1, 0)}
            aria-valuenow={focus ?? Math.max(count - 1, 0)}
            aria-valuetext={focus !== undefined && focus < count
              ? `${time(times[focus]!)}: ${series
                  .map((entry) => `${entry.label} ${format(entry.values[focus] ?? 0)}`)
                  .join(', ')}`
              : 'Latest'}
            onpointermove={move}
            onpointerleave={leave}
            onclick={() => hovered !== undefined && onpick?.(hovered)}
            {onkeydown}
          />
        </g>
      </svg>
      {#if focus !== undefined && focus < count}
        <div
          class="tooltip"
          class:left={x(focus) > plotWidth / 2}
          style:left={`${MARGIN.left + x(focus)}px`}
        >
          <strong>{time(times[focus]!)}</strong>
          {#each series as entry (entry.label)}
            <span
              ><i class="swatch slot-{entry.slot}"></i>{entry.label}
              {format(entry.values[focus] ?? 0)}</span
            >
          {/each}
          {#if marks?.[focus]}<span class="over">{marksLabel}</span>{/if}
        </div>
      {/if}
    {/if}
  </div>
</figure>

<style>
  .chart {
    /* The validated default categorical pair (blue, orange), per color scheme. */
    --chart-1: light-dark(#2a78d6, #3987e5);
    --chart-2: light-dark(#eb6834, #d95926);
    margin: 0;
    min-width: 0;
  }
  .legend {
    display: flex;
    gap: var(--nf-space-3);
    padding: 0 0 var(--nf-space-1) 44px;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .legend .title {
    color: var(--nf-color-text);
  }
  .legend span,
  .tooltip span {
    display: inline-flex;
    gap: var(--nf-space-1);
    align-items: center;
  }
  .swatch {
    display: inline-block;
    width: 10px;
    height: 2px;
    border-radius: 1px;
  }
  .swatch.slot-1 {
    background: var(--chart-1);
  }
  .swatch.slot-2 {
    background: var(--chart-2);
  }
  .swatch.budget {
    height: 0;
    border-top: 1px dashed var(--nf-color-text-muted);
  }
  .plot {
    position: relative;
  }
  svg {
    display: block;
  }
  .grid {
    stroke: var(--nf-color-border);
    stroke-width: 1;
  }
  .axis {
    fill: var(--nf-color-text-faint);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
  .budget {
    stroke: var(--nf-color-text-muted);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  .line {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .line.slot-1 {
    stroke: var(--chart-1);
  }
  .line.slot-2 {
    stroke: var(--chart-2);
  }
  .dot {
    stroke: var(--nf-color-bg);
    stroke-width: 2;
  }
  .dot.slot-1 {
    fill: var(--chart-1);
  }
  .dot.slot-2 {
    fill: var(--chart-2);
  }
  .mark {
    fill: var(--nf-color-warning);
  }
  .crosshair {
    stroke: var(--nf-color-text-faint);
    stroke-width: 1;
  }
  .hit {
    fill: transparent;
    cursor: crosshair;
  }
  .hit:focus-visible {
    outline: 1px solid var(--nf-color-focus);
  }
  .tooltip {
    position: absolute;
    top: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    margin-left: 8px;
    padding: var(--nf-space-1) var(--nf-space-2);
    border: 1px solid var(--nf-color-border-strong);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-raised);
    color: var(--nf-color-text);
    font-size: var(--nf-font-size-sm);
    white-space: nowrap;
    pointer-events: none;
  }
  .tooltip.left {
    margin-left: -8px;
    transform: translateX(-100%);
  }
  .tooltip .over {
    color: var(--nf-color-text-muted);
  }
</style>
