import type { GitStatus } from '@nanoforge-dev/editor-sdk';

/** `main ↑1 ↓2`: the branch and how far it is from its upstream. */
export const branchLabel = (status: GitStatus | undefined): string => {
  if (!status?.repository) return '';
  const name = status.branch ?? (status.head ? `detached at ${status.head}` : 'no branch');
  const sync = [status.ahead && `↑${status.ahead}`, status.behind && `↓${status.behind}`]
    .filter(Boolean)
    .join(' ');
  return sync ? `${name} ${sync}` : name;
};
