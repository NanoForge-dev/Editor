import type { GitChange, GitFile, GitStatus } from '@nanoforge-dev/editor-sdk';

import { CHANGE_TITLES } from './change-titles.const';

export interface FileRow {
  readonly file: GitFile;
  /** M, A, D, R, U (unversioned) or C (conflict). */
  readonly letter: GitChange | 'C';
  readonly title: string;
  /** File name, and the folder it is in (shown dimmed after the name). */
  readonly name: string;
  readonly folder: string;
}

const row = (file: GitFile, letter: GitChange | 'C'): FileRow => {
  const path = file.path.replace(/\/$/, '');
  const slash = path.lastIndexOf('/');
  return {
    file,
    letter,
    title: file.from ? `${CHANGE_TITLES[letter]} (was ${file.from})` : CHANGE_TITLES[letter],
    name: path.slice(slash + 1) + (file.path.endsWith('/') ? '/' : ''),
    folder: slash < 0 ? '' : path.slice(0, slash),
  };
};

export interface ChangeGroups {
  readonly conflicts: FileRow[];
  /** Files git knows that changed, staged or not. */
  readonly changes: FileRow[];
  /** Files git does not know yet. */
  readonly unversioned: FileRow[];
}

/** The files of a status as the Commit panel lists them. */
export const changeGroups = (status: Pick<GitStatus, 'files'>): ChangeGroups => ({
  conflicts: status.files.filter((file) => file.conflicted).map((file) => row(file, 'C')),
  changes: status.files
    .filter((file) => !file.conflicted && (file.staged || file.unstaged !== 'U'))
    .map((file) => row(file, file.staged ?? file.unstaged ?? 'M')),
  unversioned: status.files
    .filter((file) => !file.conflicted && !file.staged && file.unstaged === 'U')
    .map((file) => row(file, 'U')),
});

/**
 * The files checked for the next commit after the list changed: files already listed keep
 * their state, new changes are checked, new unversioned files are not.
 */
export const nextChecked = (
  checked: ReadonlySet<string>,
  known: ReadonlySet<string>,
  groups: ChangeGroups,
): Set<string> => {
  const next = new Set<string>();
  for (const { file } of [...groups.changes, ...groups.unversioned]) {
    if (known.has(file.path) ? checked.has(file.path) : file.unstaged !== 'U' || !!file.staged)
      next.add(file.path);
  }
  return next;
};
