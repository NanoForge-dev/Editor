import type { GitStatus } from '@nanoforge-dev/editor-sdk';
import type { FileDecoration } from '@nanoforge-dev/editor-sdk/ui';

import { CHANGE_TITLES } from './change-titles.const';

const TONES = { M: 'modified', R: 'modified', A: 'added', U: 'added', D: 'deleted' } as const;

/** The mark of a file or folder in the Files panel. */
export const decorationOf = (
  status: Pick<GitStatus, 'files'> | undefined,
  path: string,
  kind: 'file' | 'directory',
): FileDecoration | undefined => {
  if (!status?.files.length) return undefined;
  if (kind === 'directory') {
    const inside = status.files.filter((file) => file.path.startsWith(`${path}/`));
    if (!inside.length) return undefined;
    const conflict = inside.some((file) => file.conflicted);
    return {
      badge: '•',
      tone: conflict ? 'conflict' : 'modified',
      tooltip: `${inside.length} changed ${inside.length === 1 ? 'file' : 'files'} inside`,
    };
  }
  const file = status.files.find(
    (candidate) =>
      candidate.path === path || (candidate.path.endsWith('/') && path.startsWith(candidate.path)),
  );
  if (!file) return undefined;
  if (file.conflicted) return { badge: 'C', tone: 'conflict', tooltip: CHANGE_TITLES.C };
  const letter = file.unstaged ?? file.staged;
  return letter && { badge: letter, tone: TONES[letter], tooltip: CHANGE_TITLES[letter] };
};
