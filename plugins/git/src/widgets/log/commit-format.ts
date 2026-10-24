import type { GitBranch, GitStatus } from '@nanoforge-dev/editor-sdk';

export type RefKind = 'head' | 'local' | 'remote' | 'tag';

/** `Today 14:32`, `Yesterday 09:10`, else the date and time. */
export const commitTime = (seconds: number, now: number): string => {
  const date = new Date(seconds * 1000);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const today = new Date(now);
  const startOfToday = Date.parse(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00`,
  );
  if (date.getTime() >= startOfToday) return `Today ${time}`;
  if (date.getTime() >= startOfToday - 86_400_000) return `Yesterday ${time}`;
  return `${date.toLocaleDateString()} ${time}`;
};

/** Labels after IntelliJ's: the current branch, local branches, remote branches, tags. */
export const refKind = (ref: string, status: GitStatus, branches: readonly GitBranch[]): RefKind =>
  ref.startsWith('tag: ')
    ? 'tag'
    : ref === status.branch
      ? 'head'
      : branches.find((branch) => branch.name === ref)?.remote
        ? 'remote'
        : 'local';

/** The file name of a path, and the folder it is in. */
export const splitPath = (path: string): { name: string; folder: string } => {
  const slash = path.lastIndexOf('/');
  return { name: path.slice(slash + 1), folder: slash < 0 ? '' : path.slice(0, slash) };
};
