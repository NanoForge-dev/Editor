import { z } from 'zod';

/** What happened to a file: modified, added, deleted, renamed, untracked. */
export const GitChange = z.enum(['M', 'A', 'D', 'R', 'U']);
export type GitChange = z.output<typeof GitChange>;

export const GitFile = z.object({
  path: z.string(),
  /** Where a renamed file was. */
  from: z.string().optional(),
  /** Change staged for the next commit. */
  staged: GitChange.optional(),
  /** Change in the working files, not staged (`U`: untracked). */
  unstaged: GitChange.optional(),
  /** A merge left conflict markers in it. */
  conflicted: z.boolean(),
});
export type GitFile = z.output<typeof GitFile>;

export const GitStatus = z.object({
  /** False: the project folder is not a repository (everything else is empty). */
  repository: z.boolean(),
  /** Current branch; undefined on a detached HEAD. */
  branch: z.string().optional(),
  /** Short hash of the current commit; undefined before the first commit. */
  head: z.string().optional(),
  upstream: z.string().optional(),
  ahead: z.number().int(),
  behind: z.number().int(),
  /** A merge is in progress (a pull that conflicted). */
  merging: z.boolean(),
  files: z.array(GitFile),
});
export type GitStatus = z.output<typeof GitStatus>;

export const GitBranch = z.object({
  /** `main`, or `origin/main` for a branch of a remote. */
  name: z.string(),
  current: z.boolean(),
  upstream: z.string().optional(),
  remote: z.boolean(),
});
export type GitBranch = z.output<typeof GitBranch>;

export const GitCommit = z.object({
  hash: z.string(),
  shortHash: z.string(),
  subject: z.string(),
  author: z.string(),
  /** Seconds since epoch. */
  time: z.number(),
  /** Branches and tags pointing at it (`main`, `origin/main`, `tag: v1`). */
  refs: z.array(z.string()),
});
export type GitCommit = z.output<typeof GitCommit>;

export const GitStash = z.object({ index: z.number().int(), message: z.string() });
export type GitStash = z.output<typeof GitStash>;
