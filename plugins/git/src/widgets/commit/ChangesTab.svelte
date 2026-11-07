<script lang="ts">
  import { untrack } from 'svelte';

  import type { GitStatus } from '@nanoforge-dev/editor-sdk';
  import { ContextMenu, Icon, IconButton, type MenuEntry } from '@nanoforge-dev/editor-sdk/ui';

  import { type FileRow, changeGroups } from '../../model/change-groups';
  import { getSession } from '../../session/git-session';
  import type { Confirmation } from '../confirmation.type';
  import ChangeGroupNode from './ChangeGroupNode.svelte';
  import CommitMessage from './CommitMessage.svelte';
  import {
    type ChangeGroup,
    GROUP_STOP,
    MAX_ROWS,
    groupOfStop,
    keyStops,
    pathsOf,
  } from './change-group';
  import { onChangesKey } from './changes-keys';
  import type { CommitPanelState } from './commit-panel-state.svelte';

  interface Props {
    status: GitStatus;
    panel: CommitPanelState;
    confirm: (request: Confirmation) => void;
  }

  const { status, panel, confirm }: Props = $props();
  const { store, actions: act } = getSession();
  const git = store.state;

  const lists = $derived(changeGroups(status));
  const groups = $derived<ChangeGroup[]>([
    ...(lists.conflicts.length
      ? [
          {
            id: 'conflicts',
            title: 'Merge conflicts',
            rows: lists.conflicts,
            checkable: false,
          } as const,
        ]
      : []),
    { id: 'changes', title: 'Changes', rows: lists.changes, checkable: true },
    { id: 'unversioned', title: 'Unversioned files', rows: lists.unversioned, checkable: true },
  ]);
  const busy = $derived($git.busy);

  const included = $derived(
    [...lists.changes, ...lists.unversioned]
      .filter((row) => panel.checked.has(row.file.path))
      .flatMap(pathsOf),
  );

  const visibleRows = $derived(
    groups.flatMap((group) => (panel.isFolded(group) ? [] : group.rows.slice(0, MAX_ROWS))),
  );
  const visiblePaths = $derived(visibleRows.map((row) => row.file.path));
  const stops = $derived(keyStops(groups, (group) => panel.isFolded(group)));
  const current = $derived(
    panel.selectedGroup ? `${GROUP_STOP}${panel.selectedGroup}` : panel.cursor,
  );
  const uid = $props.id();
  /** Id of a stop's element, for `aria-activedescendant` (screen readers say the one focused). */
  const idOf = (stop: string) => `${uid}-${encodeURIComponent(stop)}`;
  const allRows = $derived(groups.flatMap((group) => [...group.rows]));
  $effect(() => {
    const listed = new Set(allRows.map((row) => row.file.path));
    const current = untrack(() => panel.selected);
    if (current.some((path) => !listed.has(path)))
      panel.selected = current.filter((path) => listed.has(path));
  });
  const select = (event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }, path: string) =>
    panel.select(event, path, visiblePaths);
  const selectedRows = $derived(allRows.filter((row) => panel.selected.includes(row.file.path)));
  const rollbackRows = $derived(selectedRows.filter((row) => row.letter !== 'C'));
  const unversionedSelected = $derived(selectedRows.filter((row) => row.letter === 'U'));
  const conflictedSelected = $derived(selectedRows.filter((row) => row.letter === 'C'));

  const showDiff = (row: FileRow) => {
    if (row.letter === 'D') act.info(`${row.file.path} was deleted: there is nothing to compare`);
    else if (row.letter === 'U' || row.letter === 'C') void act.open(row.file.path);
    else void act.compare(row.file.path, 'HEAD', 'Last commit');
  };
  const jumpToSource = (row: FileRow) => {
    if (row.letter !== 'D') void act.open(row.file.path);
  };
  const rollback = (
    rows: readonly FileRow[] = rollbackRows,
    verb: 'Rollback' | 'Delete' = 'Rollback',
  ) => {
    if (!rows.length) return;
    confirm({
      title:
        rows.length === 1
          ? `${verb} ${rows[0]!.file.path}?`
          : `${verb} the ${rows.length} selected files?`,
      description:
        verb === 'Delete'
          ? 'The files are deleted from the disk. This cannot be undone.'
          : 'Changed files go back to the last commit. Unversioned files are deleted. This cannot be undone.',
      confirm: verb,
      run: () => void act.rollback(rows.flatMap(pathsOf)),
    });
  };

  const rowMenu = (): MenuEntry[] => [
    {
      kind: 'item',
      id: 'diff',
      label: 'Show diff',
      shortcut: 'Ctrl+D',
      disabled: selectedRows.length !== 1,
      onSelect: () => selectedRows[0] && showDiff(selectedRows[0]),
    },
    {
      kind: 'item',
      id: 'source',
      label: 'Jump to source',
      shortcut: 'F4',
      disabled: selectedRows.length !== 1 || selectedRows[0]?.letter === 'D',
      onSelect: () => selectedRows[0] && jumpToSource(selectedRows[0]),
    },
    {
      kind: 'item',
      id: 'copy-path',
      label: selectedRows.length > 1 ? 'Copy paths' : 'Copy path',
      disabled: !selectedRows.length,
      onSelect: () => void act.copyPaths(selectedRows.map((row) => row.file.path)),
    },
    ...(conflictedSelected.length
      ? ([
          { kind: 'separator' },
          {
            kind: 'item',
            id: 'resolved',
            label: 'Mark resolved',
            onSelect: async () => {
              for (const row of conflictedSelected) await act.markResolved(row.file.path);
            },
          },
        ] satisfies MenuEntry[])
      : []),
    { kind: 'separator' },
    {
      kind: 'item',
      id: 'rollback',
      label: 'Rollback…',
      shortcut: 'Ctrl+Alt+Z',
      disabled: !rollbackRows.length,
      onSelect: () => rollback(),
    },
    ...(unversionedSelected.length
      ? ([
          {
            kind: 'item',
            id: 'add',
            label: 'Add to VCS',
            onSelect: () => void act.add(unversionedSelected.map((row) => row.file.path)),
          },
          {
            kind: 'item',
            id: 'delete',
            label: 'Delete…',
            shortcut: 'Delete',
            onSelect: () => rollback(unversionedSelected, 'Delete'),
          },
          {
            kind: 'item',
            id: 'ignore',
            label: 'Add to .gitignore',
            onSelect: () => void act.ignore(unversionedSelected.map((row) => row.file.path)),
          },
        ] satisfies MenuEntry[])
      : []),
    { kind: 'separator' },
    { kind: 'item', id: 'refresh', label: 'Refresh', onSelect: () => void store.refresh() },
  ];

  const groupOf = (stop: string | undefined) => groupOfStop(groups, stop);
  const goTo = (stop: string, shiftKey = false) => {
    const group = stop.startsWith(GROUP_STOP) ? groupOf(stop) : undefined;
    if (group) panel.selectGroup(group);
    else select({ shiftKey, ctrlKey: false, metaKey: false }, stop);
    document.getElementById(idOf(stop))?.scrollIntoView({ block: 'nearest' });
  };

  const onkeydown = (event: KeyboardEvent) =>
    onChangesKey(event, {
      panel,
      stops,
      current,
      visiblePaths,
      selectedRows,
      unversionedSelected,
      groupOf,
      goTo,
      showDiff,
      jumpToSource,
      rollback,
    });
</script>

<div class="toolbar" role="toolbar" aria-label="Changes">
  <IconButton icon="refresh-cw" size={14} label="Refresh" onclick={() => void store.refresh()} />
  <IconButton
    icon="undo-2"
    size={14}
    label="Rollback"
    disabled={busy || !rollbackRows.length}
    onclick={() => rollback()}
  />
  <IconButton
    icon="file-diff"
    size={14}
    label="Show diff"
    disabled={selectedRows.length !== 1}
    onclick={() => selectedRows[0] && showDiff(selectedRows[0])}
  />
  <IconButton
    icon="archive"
    size={14}
    label="Stash changes"
    disabled={busy || (!lists.changes.length && !lists.unversioned.length)}
    onclick={() => void act.stash()}
  />
  <span class="grow"></span>
  {#if $git.reading}
    <span class="reading" role="status"><Icon name="loader-circle" size={13} />Refreshing…</span>
  {/if}
  <IconButton
    icon="chevrons-up-down"
    size={14}
    label="Expand all"
    onclick={() => (panel.folded = [])}
  />
  <IconButton
    icon="chevrons-down-up"
    size={14}
    label="Collapse all"
    onclick={() => (panel.folded = groups.map((group) => group.id))}
  />
</div>
<ContextMenu items={rowMenu}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="scroll"
    role="group"
    aria-label="Changed files"
    aria-busy={$git.reading || busy}
    aria-activedescendant={current ? idOf(current) : undefined}
    aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Space Enter"
    tabindex="0"
    {onkeydown}
    onclick={(event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('li') && !target.closest('.group')) {
        panel.selected = [];
        panel.selectedGroup = undefined;
      }
    }}
  >
    {#each groups as group (group.id)}
      <ChangeGroupNode
        {group}
        {idOf}
        folded={panel.isFolded(group)}
        active={panel.selectedGroup === group.id}
        selected={panel.selected}
        checked={panel.checked}
        onfold={(on) => panel.setFolded(group, on)}
        onselect={select}
        onselectgroup={() => panel.selectGroup(group)}
        oncheck={(paths, on) => panel.setChecked(paths, on)}
        ondiff={showDiff}
      />
    {/each}
  </div>
</ContextMenu>
<CommitMessage {status} {included} conflicted={lists.conflicts.length > 0} {panel} />

<style>
  .toolbar {
    display: flex;
    flex: none;
    gap: var(--nf-space-1);
    align-items: center;
    padding: 2px var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .grow {
    flex: 1;
  }
  .reading {
    display: flex;
    gap: var(--nf-space-1);
    align-items: center;
    color: var(--nf-color-text-muted);
  }
  .reading :global(svg) {
    animation: spin 1s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .reading :global(svg) {
      animation: none;
    }
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .scroll {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow: auto;
    list-style: none;
  }
  .scroll:focus-visible {
    outline: 1px solid var(--nf-color-focus);
    outline-offset: -1px;
  }
</style>
