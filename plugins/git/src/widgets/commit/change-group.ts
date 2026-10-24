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
