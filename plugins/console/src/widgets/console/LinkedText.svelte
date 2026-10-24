<script lang="ts">
  import type { FileTarget, FrameTarget, TextSegment } from '../../link/linkify';

  interface Props {
    segments: readonly TextSegment[];
    /** The project file behind a position in a built bundle, if it can be mapped. */
    locate: (frame: FrameTarget) => Promise<FileTarget | undefined>;
    onopen: (target: FileTarget) => void;
  }

  const { segments, locate, onopen }: Props = $props();

  const where = (target: FileTarget) =>
    `${target.path}${target.line ? `:${target.line}${target.column ? `:${target.column}` : ''}` : ''}`;
</script>

{#snippet link(text: string, target: FileTarget)}
  <button
    type="button"
    class="link"
    title={`Open ${where(target)}`}
    onclick={(event) => {
      event.stopPropagation();
      onopen(target);
    }}>{text}</button
  >
{/snippet}

{#each segments as segment, index (index)}
  {#if !segment.target}
    {segment.text}
  {:else if segment.target.kind === 'file'}
    {@render link(segment.text, segment.target)}
  {:else}
    {#await locate(segment.target)}
      {segment.text}
    {:then file}
      {#if file}{@render link(where(file), file)}{:else}{segment.text}{/if}
    {:catch}
      {segment.text}
    {/await}
  {/if}
{/each}

<style>
  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--nf-color-accent);
    font: inherit;
    text-align: left;
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
    cursor: pointer;
    overflow-wrap: anywhere;
  }
  .link:hover {
    text-decoration-color: currentColor;
  }
  .link:focus-visible {
    outline: 1px solid var(--nf-color-accent);
    outline-offset: 1px;
  }
</style>
