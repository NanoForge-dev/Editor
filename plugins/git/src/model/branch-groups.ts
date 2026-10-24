import type { GitBranch } from '@nanoforge-dev/editor-sdk';

/** Local branches (the current one first) and the branches of remotes. */
export const branchGroups = (
  branches: readonly GitBranch[],
): { local: GitBranch[]; remote: GitBranch[] } => ({
  local: branches
    .filter((branch) => !branch.remote)
    .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name)),
  remote: branches.filter((branch) => branch.remote).sort((a, b) => a.name.localeCompare(b.name)),
});
