<script lang="ts">
  import type {
    CommandOrigin,
    HistoryCommand,
    HistoryContextInfo,
    HistoryEntry,
  } from '@nanoforge-dev/editor-sdk';
  import { Icon, IconButton } from '@nanoforge-dev/editor-sdk/ui';

  import { relativeTime } from './relative-time';

  interface Props {
    context: HistoryContextInfo;
    local: CommandOrigin;
    query: string;
    now: number;
    ongoto: (entryId: number) => void;
    onclear: () => void;
    /** Shown as a collapsible group (All mode). */
    collapsible?: boolean;
  }

  const { context, local, query, now, ongoto, onclear, collapsible = false }: Props = $props();
  let collapsed = $state(false);
  let expanded = $state<ReadonlySet<number>>(new Set());
  let previewed = $state<number>();

  const matches = (command: HistoryCommand) =>
    !query.trim() ||
    command.label.toLowerCase().includes(query.trim().toLowerCase()) ||
    (command.children ?? []).some((child) =>
      child.label.toLowerCase().includes(query.trim().toLowerCase()),
    );

  const past = $derived(context.state.past.filter((entry) => matches(entry.command)));
  const future = $derived(
    [...context.state.future].reverse().filter((entry) => matches(entry.command)),
  );
  const current = $derived(context.state.past.at(-1)?.id ?? 0);

  const originOf = (entry: HistoryEntry) =>
    entry.origin.kind === local.kind && entry.origin.id === local.id
      ? undefined
      : entry.origin.kind === 'plugin'
        ? entry.origin.id
        : entry.origin.kind === 'remote'
          ? `${entry.origin.id} (remote)`
          : entry.origin.id;

  const toggle = (id: number) => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const next = new Set(expanded);
    if (!next.delete(id)) next.add(id);
    expanded = next;
  };
</script>

<section class="context" aria-label={`History of ${context.label}`}>
  <header>
    {#if collapsible}
      <button
        type="button"
        class="collapse"
        aria-expanded={!collapsed}
        onclick={() => (collapsed = !collapsed)}
      >
        <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size={14} />
        <h3>{context.label}</h3>
      </button>
    {:else}
      <h3>{context.label}</h3>
    {/if}
    <IconButton
      icon="trash-2"
      label={`Clear the history of ${context.label}`}
      size={14}
      disabled={!context.state.past.length && !context.state.future.length}
      onclick={onclear}
    />
  </header>

  {#if !collapsed}
    <ol class="entries">
      {#if !query.trim()}
        <li>
          <button
            type="button"
            class="entry initial"
            class:current={current === 0}
            aria-current={current === 0 ? 'step' : undefined}
            onclick={() => ongoto(0)}
          >
            <span class="label">Initial state</span>
          </button>
        </li>
      {/if}
      {#each [...past.map( (entry) => ({ entry, undone: false }) ), ...future.map( (entry) => ({ entry, undone: true }) )] as { entry, undone } (entry.id)}
        {@const origin = originOf(entry)}
        {@const children = entry.command.children ?? []}
        <li
          onmouseenter={() => (previewed = entry.id)}
          onmouseleave={() => previewed === entry.id && (previewed = undefined)}
        >
          <div class="row">
            {#if children.length}
              <IconButton
                icon={expanded.has(entry.id) ? 'chevron-down' : 'chevron-right'}
                label={expanded.has(entry.id) ? 'Hide steps' : `Show ${children.length} steps`}
                size={12}
                onclick={() => toggle(entry.id)}
              />
            {/if}
            <button
              type="button"
              class="entry"
              class:current={entry.id === current}
              class:undone
              class:foreign={!entry.undoable}
              aria-current={entry.id === current ? 'step' : undefined}
              title={undone ? 'Redo up to here' : 'Go back to this step'}
              onclick={() => ongoto(entry.id)}
              onfocus={() => (previewed = entry.id)}
              onblur={() => previewed === entry.id && (previewed = undefined)}
            >
              <span class="label">{entry.command.label}</span>
              {#if origin}<span class="origin">{origin}</span>{/if}
              <time datetime={new Date(entry.time).toISOString()}
                >{relativeTime(entry.time, now)}</time
              >
            </button>
          </div>
          {#if expanded.has(entry.id)}
            <ol class="steps" aria-label={`Steps of ${entry.command.label}`}>
              {#each children as child, index (index)}<li>{child.label}</li>{/each}
            </ol>
          {/if}
          {#if previewed === entry.id && entry.command.preview}
            <div class="preview" role="note" aria-label="Change preview">
              {#if entry.command.preview.title}<p class="title">
                  {entry.command.preview.title}
                </p>{/if}
              <pre class="before" aria-label="Before">{entry.command.preview.before}</pre>
              <pre class="after" aria-label="After">{entry.command.preview.after}</pre>
            </div>
          {/if}
        </li>
      {:else}
        {#if query.trim()}<li class="none">No matching change</li>{/if}
      {/each}
    </ol>
  {/if}
</section>

<style>
  .context + :global(.context) {
    border-top: 1px solid var(--nf-color-border);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--nf-space-1) var(--nf-space-2) var(--nf-space-1) var(--nf-space-3);
  }
  h3 {
    margin: 0;
    font-size: var(--nf-font-size-sm);
    font-weight: 600;
  }
  .collapse {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .entries,
  .steps {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .row {
    display: flex;
    align-items: center;
    padding-left: var(--nf-space-2);
  }
  .entry {
    display: flex;
    flex: 1;
    gap: var(--nf-space-2);
    align-items: baseline;
    min-width: 0;
    padding: 3px var(--nf-space-3) 3px var(--nf-space-2);
    border: 0;
    border-left: 2px solid transparent;
    background: none;
    color: var(--nf-color-text);
    font: inherit;
    font-size: var(--nf-font-size-sm);
    text-align: left;
    cursor: pointer;
  }
  .entry:hover {
    background: var(--nf-color-hover);
  }
  .entry.current {
    border-left-color: var(--nf-color-accent);
    background: var(--nf-color-selection);
    color: var(--nf-color-selection-text);
  }
  .entry.initial {
    margin-left: var(--nf-space-2);
    color: var(--nf-color-text-muted);
  }
  .entry.undone {
    color: var(--nf-color-text-faint);
  }
  .entry.foreign .label {
    font-style: italic;
  }
  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .origin {
    padding: 0 var(--nf-space-1);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-sunken);
    color: var(--nf-color-text-muted);
    font-size: 11px;
  }
  time {
    color: var(--nf-color-text-faint);
    font-size: 11px;
    white-space: nowrap;
  }
  .steps li {
    padding: 1px var(--nf-space-3) 1px calc(var(--nf-space-3) + 28px);
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .preview {
    margin: var(--nf-space-1) var(--nf-space-3) var(--nf-space-2) calc(var(--nf-space-3) + 12px);
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-sunken);
    overflow: hidden;
  }
  .preview .title {
    margin: 0;
    padding: 2px var(--nf-space-2);
    color: var(--nf-color-text-muted);
    font-size: 11px;
  }
  pre {
    margin: 0;
    padding: var(--nf-space-1) var(--nf-space-2);
    overflow-x: auto;
    font-family: var(--nf-font-code);
    font-size: 11px;
    line-height: 1.45;
  }
  .before {
    border-left: 3px solid var(--nf-color-danger);
  }
  .after {
    border-left: 3px solid var(--nf-color-success);
  }
  .none {
    padding: var(--nf-space-2) var(--nf-space-3);
    color: var(--nf-color-text-faint);
    font-size: var(--nf-font-size-sm);
  }
</style>
