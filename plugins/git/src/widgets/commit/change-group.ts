import type { FileRow } from '../../model/change-groups';

/** A node of the Commit panel's tree. */
export interface ChangeGroup {
  readonly id: 'conflicts' | 'changes' | 'unversioned';
  readonly title: string;
  readonly rows: readonly FileRow[];
  readonly checkable: boolean;
}

/** Rows drawn per group: a folder of dependencies that is not ignored can hold thousands. */
export const MAX_ROWS = 500;

/** A renamed file is committed and rolled back with where it was: both halves of the rename. */
export const pathsOf = (row: FileRow): string[] =>
  row.file.from ? [row.file.path, row.file.from] : [row.file.path];

/** Prefix of a group node among the stops of the keyboard (files are their path). */
export const GROUP_STOP = 'group:';

/** What the arrow keys go through: each group's node, then its files when it is unfolded. */
export const keyStops = (
  groups: readonly ChangeGroup[],
  isFolded: (group: ChangeGroup) => boolean,
): string[] =>
  groups.flatMap((group) => [
    `${GROUP_STOP}${group.id}`,
    ...(isFolded(group) ? [] : group.rows.slice(0, MAX_ROWS).map((row) => row.file.path)),
  ]);

/** The group of a stop: the group node itself, or the group holding the file. */
export const groupOfStop = (
  groups: readonly ChangeGroup[],
  stop: string | undefined,
): ChangeGroup | undefined =>
  stop?.startsWith(GROUP_STOP)
    ? groups.find((group) => `${GROUP_STOP}${group.id}` === stop)
    : groups.find((group) => group.rows.some((row) => row.file.path === stop));
