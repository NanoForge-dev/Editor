import type { GitStatus } from '@nanoforge-dev/editor-sdk';

export const status = (patch: Partial<GitStatus> = {}): GitStatus => ({
  repository: true,
  branch: 'main',
  head: 'abc1234',
  ahead: 0,
  behind: 0,
  merging: false,
  files: [
    { path: 'a.txt', staged: 'M', unstaged: 'M', conflicted: false },
    { path: 'src/new.ts', unstaged: 'U', conflicted: false },
    { path: 'src/gone.ts', staged: 'D', conflicted: false },
    { path: 'moved.ts', from: 'old.ts', staged: 'R', conflicted: false },
    { path: 'src/deep/both.ts', conflicted: true },
  ],
  ...patch,
});
