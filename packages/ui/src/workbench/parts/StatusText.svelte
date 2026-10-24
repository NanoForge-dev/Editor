<script lang="ts">
  import type { StatusBarItem } from '../extension-point/status-bar.extension-point';

  const { item, onclick }: { item: StatusBarItem; onclick: () => void } = $props();
  const text = $derived(item.text);
</script>

{#if item.command}
  <button type="button" class="status-button" title={item.tooltip} {onclick}>{$text}</button>
{:else}
  <span class="text" title={item.tooltip}>{$text}</span>
{/if}

<style>
  .text {
    padding: 0 6px;
  }
</style>
