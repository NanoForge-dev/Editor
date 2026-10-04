<script lang="ts">
  import { type LogValue, formatLogValue, isExpandableLogValue } from '@nanoforge-dev/editor-sdk';
  import { Icon } from '@nanoforge-dev/editor-sdk/ui';

  import Self from './ValueTree.svelte';

  interface Props {
    value: LogValue;
    /** The key this value is under, shown before it. */
    name?: string;
    /** Strings are quoted below the top level. */
    nested?: boolean;
  }

  const { value, name, nested = false }: Props = $props();
  let open = $state(false);

  const expandable = $derived(isExpandableLogValue(value));
  const preview = $derived(formatLogValue(value, nested));
  const kind = $derived(
    value === null ? 'null' : typeof value === 'object' ? value.type : typeof value,
  );

  /** Children of an expanded value: `[key, value]`, the key undefined for stack text. */
  const children = $derived.by((): (readonly [string, LogValue])[] => {
    if (value === null || typeof value !== 'object') return [];
    switch (value.type) {
      case 'object':
        return [...value.entries];
      case 'array':
        return value.items.map((item, index) => [String(index), item] as const);
      case 'map':
        return value.entries.map(([key, item]) => [formatLogValue(key, true), item] as const);
      default:
        return [];
    }
  });
  const more = $derived(
    value !== null && typeof value === 'object' && 'more' in value ? (value.more ?? 0) : 0,
  );
  const stack = $derived(
    value !== null && typeof value === 'object' && value.type === 'error' ? value.stack : undefined,
  );
</script>

{#if expandable}
  <span class="value">
    <button
      type="button"
      class="toggle"
      aria-expanded={open}
      aria-label={`${open ? 'Collapse' : 'Expand'} ${name ?? 'value'}`}
      onclick={() => (open = !open)}
    >
      <Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} />
      {#if name !== undefined}<span class="key">{name}:</span>{/if}
      <span class="preview {kind}">{preview}</span>
    </button>
    {#if open}
      <span class="children" role="group">
        {#if stack}
          <span class="stack">{stack}</span>
        {/if}
        {#each children as [key, child], index (index)}
          <span class="child"><Self value={child} name={key} nested /></span>
        {/each}
        {#if more}
          <span class="child more">… {more} more</span>
        {/if}
      </span>
    {/if}
  </span>
{:else}
  <span class="leaf">
    {#if name !== undefined}<span class="key">{name}:</span>{/if}
    <span class="preview {kind}">{preview}</span>
  </span>
{/if}

<style>
  .value {
    display: inline-flex;
    flex-direction: column;
    vertical-align: top;
    max-width: 100%;
  }
  .toggle {
    display: inline-flex;
    gap: 2px;
    align-items: baseline;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .toggle:focus-visible {
    outline: 1px solid var(--nf-color-accent);
    outline-offset: 1px;
  }
  .toggle :global(svg) {
    flex: none;
    align-self: center;
    color: var(--nf-color-text-faint);
  }
  .preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .children {
    display: flex;
    flex-direction: column;
    padding-left: var(--nf-space-4);
  }
  .child,
  .leaf {
    white-space: pre-wrap;
  }
  .leaf .preview {
    white-space: pre-wrap;
  }
  .children :global(.leaf) {
    padding-left: 14px;
  }
  .key {
    margin-right: 0.5ch;
    color: var(--nf-color-text-muted);
  }
  .stack {
    padding-left: 14px;
    color: var(--nf-color-text-muted);
    white-space: pre-wrap;
  }
  .more {
    padding-left: 14px;
    color: var(--nf-color-text-faint);
  }
  .number,
  .bigint,
  .boolean {
    color: var(--nf-color-accent);
  }
  .null,
  .undefined,
  .cut,
  .circular,
  .function,
  .symbol {
    color: var(--nf-color-text-faint);
  }
  .error {
    color: var(--nf-color-danger);
  }
</style>
