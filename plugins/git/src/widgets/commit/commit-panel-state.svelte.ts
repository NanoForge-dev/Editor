import { type ChangeGroups, nextChecked } from '../../model/change-groups';
import type { ChangeGroup } from './change-group';

type Modifiers = { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean };

/**
 * What the Commit panel keeps while its tabs come and go: the folded groups, the commit message,
 * the files checked for the commit and the selection.
 */
export class CommitPanelState {
  folded = $state<readonly string[]>([]);
  /** The last commit messages, the newest first (the clock button). */
  messages = $state<readonly string[]>([]);
  message = $state('');
  amend = $state(false);
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- replaced, never mutated
  checked = $state<ReadonlySet<string>>(new Set());
  selected = $state<readonly string[]>([]);
  /** A group node selected by a click on it (its files are then all selected). */
  selectedGroup = $state<ChangeGroup['id']>();
  cursor = $state<string>();
  private _anchor: string | undefined;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- replaced, never mutated
  private _known: ReadonlySet<string> = new Set();

  constructor(saved: { folded?: readonly string[]; messages?: readonly string[] }) {
    this.folded = saved.folded ?? [];
    this.messages = saved.messages ?? [];
  }

  isFolded(group: ChangeGroup): boolean {
    return this.folded.includes(group.id);
  }

  setFolded(group: ChangeGroup, on: boolean): void {
    this.folded = on
      ? // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a throwaway copy
        [...new Set([...this.folded, group.id])]
      : this.folded.filter((id) => id !== group.id);
  }

  /** Follows a new list of changes: see `nextChecked`. */
  syncChecked(lists: ChangeGroups): void {
    this.checked = nextChecked(this.checked, this._known, lists);
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- replaced, never mutated
    this._known = new Set([...lists.changes, ...lists.unversioned].map((row) => row.file.path));
  }

  setChecked(paths: readonly string[], on: boolean): void {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- replaced, never mutated
    const next = new Set(this.checked);
    for (const path of paths) {
      if (on) next.add(path);
      else next.delete(path);
    }
    this.checked = next;
  }

  /** A click on a file: `order` is the visible files, for a Shift range. */
  select(event: Modifiers, path: string, order: readonly string[]): void {
    this.selectedGroup = undefined;
    this.cursor = path;
    if (event.shiftKey && this._anchor) {
      const [from, to] = [order.indexOf(this._anchor), order.indexOf(path)].sort((x, y) => x - y);
      this.selected = order.slice(Math.max(from!, 0), to! + 1);
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      this.selected = this.selected.includes(path)
        ? this.selected.filter((other) => other !== path)
        : [...this.selected, path];
    } else this.selected = [path];
    this._anchor = path;
  }

  /** A click on a group node selects the node, and with it every file of the group. */
  selectGroup(group: ChangeGroup): void {
    this.selectedGroup = group.id;
    this.selected = group.rows.map((row) => row.file.path);
    this._anchor = this.selected[0];
    this.cursor = this.selected[0];
  }

  /** Keeps a commit message in the history. */
  remember(message: string): void {
    this.messages = [message, ...this.messages.filter((other) => other !== message)].slice(0, 10);
  }
}
