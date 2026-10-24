<script lang="ts">
  import { Button, Icon } from '@nanoforge-dev/editor-sdk/ui';

  import type { FileRow } from '../../model/change-groups';
  import { getSession } from '../../session/git-session';
  import { type ChangeGroup, MAX_ROWS } from './change-group';

  type Modifiers = { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean };

  interface Props {
    group: ChangeGroup;
    folded: boolean;
    /** Whether the group node itself is selected. */
    active: boolean;
    selected: readonly string[];
    checked: ReadonlySet<string>;
    onfold: (folded: boolean) => void;
    onselect: (event: Modifiers, path: string) => void;
    onselectgroup: () => void;
    oncheck: (paths: readonly string[], on: boolean) => void;
    ondiff: (row: FileRow) => void;
  }

  const {
    group,
    folded,
    active,
    selected,
    checked,
    onfold,
    onselect,
    onselectgroup,
    oncheck,
    ondiff,
  }: Props = $props();
  const { actions: act } = getSession();
  const count = $derived(group.rows.filter((row) => checked.has(row.file.path)).length);
</script>

{#snippet fileRow(row: FileRow, checkable: boolean)}
  <li
    role="option"
    aria-label={row.file.path}
    aria-selected={selected.includes(row.file.path)}
    class:selected={selected.includes(row.file.path)}
    data-path={row.file.path}
    title={`${row.title}: ${row.file.path}`}
    onclick={(event) => onselect(event, row.file.path)}
    ondblclick={() => ondiff(row)}
    oncontextmenu={(event) => {
      if (!selected.includes(row.file.path)) onselect(event, row.file.path);
    }}
    onkeydown={() => undefined}
  >
    {#if checkable}
      <input
        type="checkbox"
        tabindex="-1"
        aria-label={`Include ${row.file.path}`}
        checked={checked.has(row.file.path)}
        onclick={(event) => event.stopPropagation()}
        onchange={(event) => oncheck([row.file.path], event.currentTarget.checked)}
      />
    {/if}
    <Icon name="file-code" size={13} />
    <span class="name" data-letter={row.letter}>{row.name}</span>
    {#if row.folder}<span class="folder">{row.folder}</span>{/if}
    {#if row.letter === 'C'}
      <Button
        size="sm"
        variant="ghost"
        onclick={(event) => {
          event.stopPropagation();
          void act.markResolved(row.file.path);
        }}>Mark resolved</Button
      >
    {/if}
  </li>
{/snippet}

<section aria-label={group.title}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="group" class:selected={active} onclick={onselectgroup}>
    <button
      type="button"
      class="chevron"
      tabindex="-1"
      aria-expanded={!folded}
      aria-label={`${folded ? 'Expand' : 'Collapse'} ${group.title}`}
      onclick={(event) => {
        event.stopPropagation();
        onfold(!folded);
      }}
    >
      <Icon name={folded ? 'chevron-right' : 'chevron-down'} size={12} />
    </button>
    {#if group.checkable}
      <input
        type="checkbox"
        tabindex="-1"
        aria-label={`Include all: ${group.title}`}
        checked={group.rows.length > 0 && count === group.rows.length}
        indeterminate={count > 0 && count < group.rows.length}
        disabled={!group.rows.length}
        onclick={(event) => event.stopPropagation()}
        onchange={(event) =>
          oncheck(
            group.rows.map((row) => row.file.path),
            event.currentTarget.checked,
          )}
      />
    {/if}
    <span class="title">{group.title}</span>
    <span class="count">{group.rows.length} {group.rows.length === 1 ? 'file' : 'files'}</span>
  </div>
  {#if !folded}
    <ul role="listbox" aria-multiselectable="true" aria-label={`${group.title}: files`}>
      {#each group.rows.slice(0, MAX_ROWS) as row (row.file.path)}
        {@render fileRow(row, group.checkable)}
      {/each}
    </ul>
    {#if group.rows.length > MAX_ROWS}
      <p class="none">
        {group.rows.length - MAX_ROWS} more files are not shown. If they are dependencies or build output,
        add their folder to .gitignore.
      </p>
    {/if}
  {/if}
</section>

<style>
  input[type='checkbox'] {
    flex: none;
    margin: 0;
    accent-color: var(--nf-color-accent);
  }
  .group {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
    padding: 2px var(--nf-space-2) 2px var(--nf-space-1);
    cursor: default;
    user-select: none;
  }
  .chevron {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--nf-color-text-muted);
    cursor: pointer;
  }
  .title {
    font-weight: 600;
  }
  .count {
    margin-left: var(--nf-space-1);
    color: var(--nf-color-text-faint);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
    padding: 2px var(--nf-space-2) 2px 24px;
    cursor: default;
    user-select: none;
    white-space: nowrap;
  }
  li :global(svg) {
    flex: none;
    color: var(--nf-color-text-faint);
  }
  li:hover,
  .group:hover {
    background: var(--nf-color-hover);
  }
  li.selected,
  .group.selected {
    background: var(--nf-color-selection);
    color: var(--nf-color-selection-text);
  }
  .name[data-letter='M'],
  .name[data-letter='R'] {
    color: var(--git-modified);
  }
  .name[data-letter='A'] {
    color: var(--git-added);
  }
  .name[data-letter='D'] {
    color: var(--git-deleted);
  }
  .name[data-letter='U'] {
    color: var(--git-unversioned);
  }
  .name[data-letter='C'] {
    color: var(--git-conflict);
  }
  li.selected .name,
  li.selected .folder,
  li.selected :global(svg) {
    color: inherit;
  }
  .folder {
    flex: 1;
    min-width: 0;
    margin-left: var(--nf-space-1);
    overflow: hidden;
    color: var(--nf-color-text-faint);
    text-overflow: ellipsis;
  }
  .none {
    padding: var(--nf-space-2) var(--nf-space-4);
    color: var(--nf-color-text-faint);
  }
</style>
