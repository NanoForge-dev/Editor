import { z } from 'zod';

import { defineContract } from '@nanoforge-dev/editor-rpc';

import { ProjectPath } from '../path/project-path';
import { ProjectId } from '../project/project.schema';
import { GitBranch, GitChange, GitCommit, GitStash, GitStatus } from './git.schema';

const Project = z.object({ project: ProjectId });
const Paths = Project.extend({ paths: z.array(ProjectPath).min(1) });
const BranchName = z
  .string()
  .min(1)
  .max(200)
  .regex(/^(?!-)(?!.*\.\.)[^\s~^:?*[\\]+$/, 'not a valid branch name');
const Hash = z.string().regex(/^[0-9a-f]{7,40}$/);

/**
 * Git operations on the repository of a project's folder (local editors only). A repository
 * above the folder is never used.
 */
export const GitContract = defineContract('git', {
  methods: {
    status: { input: Project, output: GitStatus },
    init: { input: Project, output: z.null() },
    stage: { input: Paths, output: z.null() },
    unstage: { input: Paths, output: z.null() },
    /**
     * Rolls files back to the last commit. A file added since then stays on disk, out of git;
     * a file git never knew is deleted.
     */
    discard: { input: Paths, output: z.null() },
    /**
     * Commits `paths` only (whatever else is staged stays out), the staged changes without
     * `paths`, or everything with `all`. `amend` replaces the last commit.
     */
    commit: {
      input: Project.extend({
        message: z.string().min(1),
        all: z.boolean().default(false),
        paths: z.array(ProjectPath).optional(),
        amend: z.boolean().default(false),
      }),
      output: z.null(),
    },
    fetch: { input: Project, output: z.null() },
    /** Merge pull. `conflicts`: the merge stopped on conflicts (see the status). */
    pull: { input: Project, output: z.object({ conflicts: z.boolean() }) },
    /** Pushes the branch, setting its upstream (`origin`) on the first push. */
    push: { input: Project, output: z.null() },
    branches: { input: Project, output: z.array(GitBranch) },
    /** A branch of a remote (`origin/x`) is checked out as a local branch tracking it. */
    switchBranch: { input: Project.extend({ name: BranchName }), output: z.null() },
    /** Creates a branch at the current commit, or at `from` (a branch), and switches to it. */
    createBranch: {
      input: Project.extend({ name: BranchName, from: BranchName.optional() }),
      output: z.null(),
    },
    /** `force`: also when it is not merged. */
    deleteBranch: {
      input: Project.extend({ name: BranchName, force: z.boolean().default(false) }),
      output: z.null(),
    },
    log: {
      input: Project.extend({
        limit: z.number().int().min(1).max(200).default(50),
        skip: z.number().int().min(0).default(0),
        /** A branch to list instead of the current one. */
        branch: BranchName.optional(),
      }),
      output: z.array(GitCommit),
    },
    /** Commits a push would send: those the upstream does not have (all, without one). */
    outgoing: { input: Project, output: z.array(GitCommit) },
    /** Files a commit changed. */
    commitFiles: {
      input: Project.extend({ hash: Hash }),
      output: z.array(z.object({ path: z.string(), change: GitChange })),
    },
    /**
     * Text of a file at a revision: `HEAD`, `INDEX` (staged), or `<hash>^` (before a commit).
     * Null when the file does not exist there.
     */
    show: {
      input: Project.extend({
        path: ProjectPath,
        revision: z.string().regex(/^(HEAD|INDEX|[0-9a-f]{7,40}\^?)$/),
      }),
      output: z.string().nullable(),
    },
    stashes: { input: Project, output: z.array(GitStash) },
    /** Stashes the changes, untracked files included. */
    stash: { input: Project.extend({ message: z.string().optional() }), output: z.null() },
    /** `pop`: drops the stash once applied. */
    applyStash: {
      input: Project.extend({ index: z.number().int().min(0), pop: z.boolean().default(false) }),
      output: z.null(),
    },
    dropStash: { input: Project.extend({ index: z.number().int().min(0) }), output: z.null() },
  },
});
