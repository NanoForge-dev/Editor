<script lang="ts">
  import type { FrameLocator, createSegmenter } from '../../link/frame-locator';
  import type { FileTarget } from '../../link/linkify';
  import type { ConsoleLine } from '../../store/console-store';
  import { sourceLabel } from '../../store/log-sources';
  import LinkedText from './LinkedText.svelte';
  import ValueTree from './ValueTree.svelte';

  interface Props {
    line: ConsoleLine;
    segmentsOf: ReturnType<typeof createSegmenter>;
    locate: FrameLocator['locate'];
    onopen: (target: FileTarget) => void;
  }

  const { line, segmentsOf, locate, onopen }: Props = $props();

  const time = (value: number) => new Date(value).toLocaleTimeString([], { hour12: false });
  const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
</script>

<div
  class="line {line.level}"
  data-line={line.id}
  data-group={line.group}
  data-source={line.source}
>
  <time>{time(line.time)}</time>
  <span class="source" title={line.source}>{sourceLabel(line.source)}</span>
  <span class="message">
    {#if line.values}
      {#each line.values as value, index (index)}
        <span class="part">
          {#if typeof value === 'string'}
            <LinkedText segments={segmentsOf(line, value)} {locate} {onopen} />
          {:else}
            <ValueTree {value} />
          {/if}
        </span>
      {/each}
    {:else}
      <LinkedText segments={segmentsOf(line, line.text)} {locate} {onopen} />
    {/if}
  </span>
  {#if line.count > 1}
    <span class="count" title={`Logged ${line.count} times in a row`}>
      <span class="sr">Repeated</span>
      {line.count}
      <span class="sr">times</span>
    </span>
  {/if}
  {#if line.location}
    {#await locate(line.location) then file}
      {#if file}
        <button
          type="button"
          class="where"
          title={`Open ${file.path}:${file.line}`}
          onclick={() => onopen(file)}>{fileName(file.path)}:{file.line}</button
        >
      {/if}
    {/await}
  {/if}
</div>

<style>
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .line {
    display: flex;
    gap: var(--nf-space-2);
    align-items: baseline;
    padding: 1px var(--nf-space-3);
    border-left: 2px solid transparent;
  }
  .line:hover {
    background: var(--nf-color-hover);
  }
  time,
  .source {
    flex: none;
    color: var(--nf-color-text-faint);
  }
  .source {
    max-width: 16ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .message {
    flex: 1;
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .part:not(:last-child) {
    margin-right: 1ch;
  }
  .debug .message {
    color: var(--nf-color-text-muted);
  }
  .warn {
    border-left-color: var(--nf-color-warning);
  }
  .warn .message {
    color: var(--nf-color-warning);
  }
  .error {
    border-left-color: var(--nf-color-danger);
  }
  .error .message {
    color: var(--nf-color-danger);
  }
  .count {
    flex: none;
    min-width: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--nf-color-sunken);
    color: var(--nf-color-text-muted);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .where {
    flex: none;
    padding: 0;
    border: 0;
    background: none;
    color: var(--nf-color-text-faint);
    font: inherit;
    cursor: pointer;
  }
  .where:hover {
    color: var(--nf-color-accent);
    text-decoration: underline;
  }
</style>
