import type { FileRow } from '../../model/change-groups';
import { type ChangeGroup, GROUP_STOP } from './change-group';
import type { CommitPanelState } from './commit-panel-state.svelte';

/** What the keys of the Changes tree read and act on, taken when a key is pressed. */
export interface ChangesKeyContext {
  readonly panel: Pick<
    CommitPanelState,
    'checked' | 'selected' | 'selectedGroup' | 'isFolded' | 'setFolded' | 'setChecked'
  >;
  /** The keyboard's stops, in order (see `keyStops`). */
  readonly stops: readonly string[];
  /** The stop at the cursor. */
  readonly current: string | undefined;
  readonly visiblePaths: readonly string[];
  readonly selectedRows: readonly FileRow[];
  readonly unversionedSelected: readonly FileRow[];
  readonly groupOf: (stop: string | undefined) => ChangeGroup | undefined;
  readonly goTo: (stop: string, shiftKey?: boolean) => void;
  readonly showDiff: (row: FileRow) => void;
  readonly jumpToSource: (row: FileRow) => void;
  readonly rollback: (rows?: readonly FileRow[], verb?: 'Rollback' | 'Delete') => void;
}

/**
 * Keys of the Changes tree (it keeps the focus; the row at the cursor is its active descendant):
 * Up and Down go through group nodes and files, Left folds a group or goes up to it, Right
 * unfolds, Space includes the selection (or a group's files) in the commit, Enter shows the diff
 * or folds a group.
 */
export const onChangesKey = (event: KeyboardEvent, context: ChangesKeyContext): void => {
  if (event.target !== event.currentTarget) return;
  const { panel, stops, current, selectedRows, unversionedSelected, groupOf, goTo } = context;
  const mod = event.ctrlKey || event.metaKey;
  const first = selectedRows[0];
  const group = current?.startsWith(GROUP_STOP) ? groupOf(current) : undefined;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!stops.length) return;
    const at = current ? stops.indexOf(current) : -1;
    const next =
      stops[Math.min(Math.max(at + (event.key === 'ArrowDown' ? 1 : -1), 0), stops.length - 1)]!;
    goTo(next, event.shiftKey && !next.startsWith(GROUP_STOP) && !group);
  } else if (event.key === 'ArrowLeft') {
    if (group) panel.setFolded(group, true);
    else if (current) {
      const parent = groupOf(current);
      if (parent) goTo(`${GROUP_STOP}${parent.id}`);
    }
  } else if (event.key === 'ArrowRight') {
    if (!group) return;
    if (panel.isFolded(group)) panel.setFolded(group, false);
    else if (group.rows[0]) goTo(group.rows[0].file.path);
  } else if (event.key === ' ' && group) {
    if (!group.checkable || !group.rows.length) return;
    const paths = group.rows.map((row) => row.file.path);
    panel.setChecked(paths, !paths.every((path) => panel.checked.has(path)));
  } else if (event.key === 'Enter' && group) {
    panel.setFolded(group, !panel.isFolded(group));
  } else if (mod && event.key.toLowerCase() === 'a') {
    panel.selected = context.visiblePaths;
    panel.selectedGroup = undefined;
  } else if (event.key === ' ') {
    const paths = selectedRows.filter((row) => row.letter !== 'C').map((row) => row.file.path);
    if (!paths.length) return;
    panel.setChecked(paths, !paths.every((path) => panel.checked.has(path)));
  } else if ((mod && event.key.toLowerCase() === 'd') || event.key === 'Enter') {
    if (!first) return;
    context.showDiff(first);
  } else if (event.key === 'F4') {
    if (!first) return;
    context.jumpToSource(first);
  } else if (mod && event.altKey && event.key.toLowerCase() === 'z') context.rollback();
  else if (event.key === 'Delete') {
    if (!unversionedSelected.length) return;
    context.rollback(unversionedSelected, 'Delete');
  } else return;
  event.preventDefault();
  event.stopPropagation();
};
