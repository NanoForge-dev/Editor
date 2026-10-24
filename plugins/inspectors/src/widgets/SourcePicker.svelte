<script lang="ts">
  import type { GameSource } from '../recorder/recorder';

  interface Props {
    sources: readonly GameSource[];
    value: GameSource;
    onchange: (source: GameSource) => void;
  }

  const { sources, value, onchange }: Props = $props();
  const LABELS = { client: 'Client', server: 'Server' } as const;
</script>

{#if sources.length > 1}
  <div class="picker" role="group" aria-label="Game">
    {#each sources as source (source)}
      <button type="button" aria-pressed={source === value} onclick={() => onchange(source)}
        >{LABELS[source]}</button
      >
    {/each}
  </div>
{:else if sources.length}
  <span class="single">{LABELS[sources[0]!]}</span>
{/if}

<style>
  .picker {
    display: inline-flex;
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-control);
    overflow: hidden;
  }
  button {
    height: 22px;
    padding: 0 var(--nf-space-2);
    border: 0;
    background: none;
    color: var(--nf-color-text-muted);
    font: inherit;
    font-size: var(--nf-font-size-sm);
    cursor: pointer;
  }
  button[aria-pressed='true'] {
    background: var(--nf-color-pressed);
    color: var(--nf-color-text);
  }
  button:focus-visible {
    outline: 1px solid var(--nf-color-focus);
    outline-offset: -1px;
  }
  .single {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
</style>
