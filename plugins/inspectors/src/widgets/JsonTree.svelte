<script lang="ts">
  import type { EngineWorldValue } from '@nanoforge-dev/editor-sdk';
  import { Icon } from '@nanoforge-dev/editor-sdk/ui';

  import Self from './JsonTree.svelte';

  const { name, value }: { name: string; value: EngineWorldValue } = $props();
  let open = $state(false);

  const entries = $derived(
    value === null || typeof value !== 'object'
      ? []
      : Array.isArray(value)
        ? value.map((item, index) => [String(index), item] as const)
        : Object.entries(value).filter(([key]) => key !== '$class'),
  );
  const summary = $derived.by(() => {
    if (value === null) return 'null';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value)) return `Array(${value.length})`;
    const type = typeof value.$class === 'string' ? value.$class : 'Object';
    return `${type} { ${entries.map(([key]) => key).join(', ')} }`;
  });
</script>

{#if entries.length}
  <div class="node">
    <button type="button" aria-expanded={open} onclick={() => (open = !open)}>
      <Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} />
      <span class="key">{name}</span>
      <span class="value">{summary}</span>
    </button>
    {#if open}
      <div class="children" role="group">
        {#each entries as [key, child] (key)}
          <Self name={key} value={child} />
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <div class="leaf">
    <span class="key">{name}</span>
    <span class="value {value === null ? 'null' : typeof value}">{summary}</span>
  </div>
{/if}

<style>
  button {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
    width: 100%;
    padding: 1px 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  button:hover,
  .leaf:hover {
    background: var(--nf-color-hover);
  }
  button:focus-visible {
    outline: 1px solid var(--nf-color-focus);
    outline-offset: -1px;
  }
  .children {
    padding-left: var(--nf-space-4);
  }
  .leaf {
    display: flex;
    gap: var(--nf-space-1);
    padding: 1px 0 1px 16px;
  }
  .key {
    color: var(--nf-color-text-muted);
  }
  .key::after {
    content: ':';
  }
  .value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .value.number,
  .value.boolean {
    color: var(--nf-color-accent);
  }
  .value.null {
    color: var(--nf-color-text-faint);
  }
</style>
