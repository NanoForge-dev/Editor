import type { GitChange } from '@nanoforge-dev/editor-sdk';

/** What each change letter means, in tooltips and row titles. */
export const CHANGE_TITLES: Record<GitChange | 'C', string> = {
  M: 'Modified',
  A: 'Added',
  D: 'Deleted',
  R: 'Renamed',
  U: 'Unversioned',
  C: 'Conflict',
};
