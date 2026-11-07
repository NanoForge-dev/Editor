<script lang="ts">
  import '@nanoforge-dev/editor-ui/fonts.css';
  import type { Snippet } from 'svelte';

  const { children }: { children: Snippet } = $props();
</script>

{@render children()}

<style>
  /* Before the theme loads (loading screen); afterwards the theme variables win. */
  :global(body) {
    margin: 0;
    background: var(--nf-color-bg, #12161d);
    color: var(--nf-color-text, #d8dde7);
    font-family: var(--nf-font-ui, 'Instrument Sans', system-ui, sans-serif);
    font-size: var(--nf-font-size-md, 13px);
  }
</style>
