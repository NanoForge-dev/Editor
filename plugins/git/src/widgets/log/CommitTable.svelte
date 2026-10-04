<script lang="ts">
  import type { GitCommit, GitStatus } from '@nanoforge-dev/editor-sdk';
  import { Button, ContextMenu, Input, type MenuEntry, Select } from '@nanoforge-dev/editor-sdk/ui';

  import { getSession } from '../../session/git-session';
  import RefLabel from './RefLabel.svelte';
  import { commitTime } from './commit-format';

  type DateRange = 'all' | 'day' | 'week';

  interface Props {
    status: GitStatus;
    selectedHash: string | undefined;
  }

  let { status, selectedHash = $bindable() }: Props = $props();
  const { store, actions: act } = getSession();
  const git = store.state;

  let query = $state('');
  let user = $state('all');
  let range = $state<DateRange>('all');
  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });
  const shownBranch = $derived($git.logBranch ?? status.branch);
  const users = $derived([...new Set($git.log.map((commit) => commit.author))].sort());
  const needle = $derived(query.trim().toLowerCase());
  const commits = $derived(
    $git.log.filter(
      (commit) =>
        (user === 'all' || commit.author === user) &&
        (range === 'all' || now / 1000 - commit.time < (range === 'day' ? 86_400 : 7 * 86_400)) &&
        (!needle ||
          commit.subject.toLowerCase().includes(needle) ||
          commit.hash.startsWith(needle)),
    ),
  );

  let menuCommit: GitCommit | undefined;
  const commitMenu = (): MenuEntry[] => {
    const commit = menuCommit;
    if (!commit) return [];
    return [
      {
        kind: 'item',
        id: 'copy',
        label: 'Copy Revision Number',
        onSelect: () => void navigator.clipboard?.writeText(commit.hash).catch(() => undefined),
      },
      {
        kind: 'item',
        id: 'branch',
        label: 'New Branch…',
        onSelect: () => void act.newBranch(commit.hash),
      },
    ];
  };
</script>

<div class="commits">
  <div class="filters">
    <Input bind:value={query} placeholder="Text or hash" aria-label="Text or hash" />
    <span class="filter" role="status" aria-label="Branch shown"
      >Branch: {shownBranch ?? 'detached'}{status.upstream && !$git.logBranch
        ? ` ↑${status.ahead} ↓${status.behind}`
        : ''}</span
    >
    <Select
      label="User"
      value={user}
      items={[
        { value: 'all', label: 'User: All' },
        ...users.map((name) => ({ value: name, label: `User: ${name}` })),
      ]}
      onchange={(value) => (user = value)}
    />
    <Select
      label="Date"
      value={range}
      items={[
        { value: 'all', label: 'Date: All' },
        { value: 'day', label: 'Date: Last 24 hours' },
        { value: 'week', label: 'Date: Last 7 days' },
      ]}
      onchange={(value) => (range = value)}
    />
  </div>
  <ContextMenu items={commitMenu}>
    <div class="rows">
      <table aria-label="Commits">
        <tbody>
          {#each commits as commit, index (commit.hash)}
            <tr
              aria-selected={commit.hash === selectedHash}
              tabindex="0"
              onclick={() => (selectedHash = commit.hash)}
              oncontextmenu={() => {
                menuCommit = commit;
                selectedHash = commit.hash;
              }}
              onkeydown={(event) => event.key === 'Enter' && (selectedHash = commit.hash)}
            >
              <td class="graph" aria-hidden="true">
                <span
                  class="dot"
                  class:first={index === 0}
                  class:last={index === commits.length - 1}
                ></span>
              </td>
              <td class="subject">
                <div class="cell">
                  <span class="text">{commit.subject}</span>
                  {#each commit.refs as ref (ref)}
                    <RefLabel {ref} {status} />
                  {/each}
                </div>
              </td>
              <td class="author">{commit.author}</td>
              <td class="date">{commitTime(commit.time, now)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if !commits.length}
        <p class="none">{$git.log.length ? 'No commit matches.' : 'No commit yet.'}</p>
      {/if}
      {#if $git.more}
        <Button size="sm" variant="ghost" onclick={() => void store.showMore()}>Show more</Button>
      {/if}
    </div>
  </ContextMenu>
</div>

<style>
  .commits {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    border-right: 1px solid var(--nf-color-border);
  }
  .filters {
    display: flex;
    flex: none;
    gap: var(--nf-space-2);
    align-items: center;
    padding: 2px var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .filters :global(input) {
    flex: 1;
    min-width: 80px;
  }
  .filter {
    flex: none;
    color: var(--nf-color-text-muted);
    white-space: nowrap;
  }
  .rows {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  td.author {
    width: 110px;
  }
  td.date {
    width: 120px;
  }
  td.author,
  td.date {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  td {
    padding: 2px var(--nf-space-2);
    color: var(--nf-color-text-muted);
    white-space: nowrap;
  }
  td.graph {
    width: 16px;
    padding: 0 0 0 var(--nf-space-2);
  }
  /* A straight line of commits: the history of one branch. */
  .dot {
    position: relative;
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ref-local);
  }
  .dot::before,
  .dot::after {
    content: '';
    position: absolute;
    left: 3px;
    width: 2px;
    height: 9px;
    background: var(--ref-local);
  }
  .dot::before {
    bottom: 8px;
  }
  .dot::after {
    top: 8px;
  }
  .dot.first::before,
  .dot.last::after {
    display: none;
  }
  td.subject {
    color: var(--nf-color-text);
  }
  .cell {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
    min-width: 0;
  }
  .cell .text {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  tbody tr {
    cursor: default;
  }
  tbody tr:hover {
    background: var(--nf-color-hover);
  }
  tbody tr:focus-visible {
    outline: 1px solid var(--nf-color-focus);
    outline-offset: -1px;
  }
  tbody tr[aria-selected='true'] {
    background: var(--nf-color-selection);
    color: var(--nf-color-selection-text);
  }
  tbody tr[aria-selected='true'] td {
    color: inherit;
  }
  .none {
    margin: 0;
    padding: var(--nf-space-2);
    color: var(--nf-color-text-muted);
  }
</style>
