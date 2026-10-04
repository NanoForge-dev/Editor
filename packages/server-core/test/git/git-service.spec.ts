import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../../src/env/load-env';
import { GitService } from '../../src/git/git-service';
import { parseStatus } from '../../src/git/parse-status';

let workspace: string;
let git: GitService;

const raw = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const write = (root: string, path: string, text: string) => {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
};
/** A repository with an identity and one commit. */
const repository = async (name: string) => {
  const root = join(workspace, name);
  mkdirSync(root, { recursive: true });
  await git.init(root);
  raw(root, 'config', 'user.name', 'Test');
  raw(root, 'config', 'user.email', 'test@example.com');
  write(root, 'a.txt', 'one\n');
  write(root, 'src/b.txt', 'two\n');
  await git.commit(root, 'first commit', { all: true });
  return root;
};
const files = async (root: string) =>
  (await git.projectStatus(root)).files.map(
    (file) => `${file.staged ?? '-'}${file.conflicted ? 'C' : (file.unstaged ?? '-')} ${file.path}`,
  );

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'nf-git-'));
  git = new GitService(loadEnv({ NODE_ENV: 'test', FS_ROOT: workspace }, workspace));
});
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

describe('parseStatus', () => {
  it('reads the branch, the upstream counts and every kind of entry', () => {
    const output = [
      '# branch.oid 1234567890abcdef',
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -1',
      '1 .M N... 100644 100644 100644 aaa bbb with space.txt',
      '1 A. N... 000000 100644 100644 aaa bbb new.txt',
      '2 R. N... 100644 100644 100644 aaa bbb R100 moved.txt',
      'old.txt',
      'u UU N... 100644 100644 100644 100644 aaa bbb ccc both.txt',
      '? untracked.txt',
      '',
    ].join('\0');
    expect(parseStatus(output)).toEqual({
      repository: true,
      branch: 'main',
      head: '1234567',
      upstream: 'origin/main',
      ahead: 2,
      behind: 1,
      files: [
        { path: 'both.txt', conflicted: true },
        { path: 'moved.txt', from: 'old.txt', staged: 'R', conflicted: false },
        { path: 'new.txt', staged: 'A', conflicted: false },
        { path: 'untracked.txt', unstaged: 'U', conflicted: false },
        { path: 'with space.txt', unstaged: 'M', conflicted: false },
      ],
    });
  });
});

describe('GitService on a project folder', () => {
  it('ignores a repository above the folder, and initializes one', async () => {
    const outer = await repository('outer');
    const inner = join(outer, 'project');
    mkdirSync(inner);
    write(inner, 'file.txt', 'x\n');
    expect(await git.projectStatus(inner)).toMatchObject({ repository: false, files: [] });
    const before = raw(outer, 'status', '--porcelain');
    await expect(git.stage(inner, ['file.txt'])).rejects.toThrow(/not a git repository/);
    await expect(git.commit(inner, 'oops', { all: true })).rejects.toThrow(/not a git repository/);
    await expect(git.discard(inner, ['file.txt'])).rejects.toThrow(/not a git repository/);
    await expect(git.stash(inner)).rejects.toThrow(/not a git repository/);
    expect(existsSync(join(inner, 'file.txt'))).toBe(true);
    expect(raw(outer, 'status', '--porcelain')).toBe(before);
    expect(raw(outer, 'log', '--format=%s')).toBe('first commit\n');
    await git.init(inner);
    const status = await git.projectStatus(inner);
    expect(status).toMatchObject({ repository: true, branch: 'main', merging: false });
    expect(status.head).toBeUndefined();
    expect(status.files).toEqual([{ path: 'file.txt', unstaged: 'U', conflicted: false }]);
    expect(await git.log(inner)).toEqual([]);
    expect(await git.branches(inner)).toEqual([{ name: 'main', current: true, remote: false }]);
  });

  it('stages, unstages, discards and commits', async () => {
    const root = await repository('changes');
    write(root, 'a.txt', 'one\nchanged\n');
    write(root, 'new.txt', 'new\n');
    rmSync(join(root, 'src/b.txt'));
    expect(await files(root)).toEqual(['-M a.txt', '-U new.txt', '-D src/b.txt']);
    write(root, 'deps/lib/index.js', 'x\n');
    write(root, 'deps/lib/other.js', 'y\n');
    expect(await files(root)).toEqual(
      expect.arrayContaining(['-U deps/lib/index.js', '-U deps/lib/other.js']),
    );
    await git.discard(root, ['deps/lib/index.js', 'deps/lib/other.js']);
    expect(existsSync(join(root, 'deps/lib/index.js'))).toBe(false);

    await git.stage(root, ['a.txt', 'new.txt', 'src/b.txt']);
    expect(await files(root)).toEqual(['M- a.txt', 'A- new.txt', 'D- src/b.txt']);
    await git.unstage(root, ['new.txt', 'src/b.txt']);
    expect(await files(root)).toEqual(['M- a.txt', '-U new.txt', '-D src/b.txt']);

    await git.discard(root, ['src/b.txt', 'new.txt']);
    expect(readFileSync(join(root, 'src/b.txt'), 'utf8')).toBe('two\n');
    expect(existsSync(join(root, 'new.txt'))).toBe(false);
    write(root, 'added.txt', 'added\n');
    await git.stage(root, ['added.txt']);
    await git.discard(root, ['added.txt']);
    expect(await files(root)).toEqual(['M- a.txt', '-U added.txt']);
    await git.discard(root, ['added.txt']);

    expect(await git.show(root, 'a.txt', 'HEAD')).toBe('one\n');
    expect(await git.show(root, 'a.txt', 'INDEX')).toBe('one\nchanged\n');
    expect(await git.show(root, 'missing.txt', 'HEAD')).toBeNull();

    write(root, 'src/b.txt', 'two\nmore\n');
    write(root, 'fresh.txt', 'fresh\n');
    await git.stage(root, ['src/b.txt']);
    await git.commit(root, 'change a', { paths: ['a.txt'] });
    expect(await files(root)).toEqual(['-U fresh.txt', 'M- src/b.txt']);
    await git.commit(root, 'b and a new file', { paths: ['src/b.txt', 'fresh.txt'] });
    expect(await files(root)).toEqual([]);
    write(root, 'fresh.txt', 'fresher\n');
    await git.commit(root, 'b and a fresh file', { paths: ['fresh.txt'], amend: true });
    expect((await git.log(root)).map((commit) => commit.subject)).toEqual([
      'b and a fresh file',
      'change a',
      'first commit',
    ]);
    raw(root, 'mv', 'fresh.txt', 'renamed.txt');
    expect((await git.projectStatus(root)).files).toEqual([
      { path: 'renamed.txt', from: 'fresh.txt', staged: 'R', conflicted: false },
    ]);
    await git.discard(root, ['renamed.txt', 'fresh.txt']);
    expect(await files(root)).toEqual(['-U renamed.txt']);
    expect(existsSync(join(root, 'fresh.txt'))).toBe(true);
    await git.discard(root, ['renamed.txt']);
    raw(root, 'mv', 'fresh.txt', 'renamed.txt');
    await git.commit(root, 'rename', { paths: ['renamed.txt', 'fresh.txt'] });
    expect(await files(root)).toEqual([]);
    raw(root, 'mv', 'renamed.txt', 'fresh.txt');
    await git.commit(root, 'rename back', { paths: ['fresh.txt', 'renamed.txt'] });
    expect(await files(root)).toEqual([]);
    write(root, 'a.txt', 'again\n');
    await git.stage(root, ['a.txt']);
    await git.discard(root, ['a.txt']);
    expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('one\nchanged\n');
    expect(await files(root)).toEqual([]);
    const log = await git.log(root);
    expect(log[0]).toMatchObject({ author: 'Test', refs: ['main'] });
    expect(log[0]!.hash).toMatch(/^[0-9a-f]{40}$/);
    const changeA = log.find((commit) => commit.subject === 'change a')!;
    expect(await git.commitFiles(root, changeA.hash)).toEqual([{ path: 'a.txt', change: 'M' }]);
    expect(await git.commitFiles(root, log[1]!.hash)).toEqual([
      { path: 'renamed.txt', change: 'R' },
    ]);
    expect(await git.show(root, 'a.txt', `${changeA.hash}^`)).toBe('one\n');
    expect((await git.log(root, 1, log.length - 1)).map((commit) => commit.subject)).toEqual([
      'first commit',
    ]);
    await expect(git.commit(root, 'nothing')).rejects.toThrow(/nothing to commit/);
  });

  it('creates, switches and deletes branches', async () => {
    const root = await repository('branches');
    await git.createBranch(root, 'feature');
    expect(await git.branches(root)).toEqual([
      { name: 'feature', current: true, remote: false },
      { name: 'main', current: false, remote: false },
    ]);
    write(root, 'a.txt', 'feature\n');
    await git.commit(root, 'on feature', { all: true });
    await git.switchBranch(root, 'main');
    expect((await git.projectStatus(root)).branch).toBe('main');
    await git.createBranch(root, 'from-feature', 'feature');
    expect((await git.log(root, 1))[0]!.subject).toBe('on feature');
    await git.switchBranch(root, 'main');
    await git.deleteBranch(root, 'from-feature', true);
    expect((await git.log(root, 50, 0, 'feature')).map((commit) => commit.subject)).toEqual([
      'on feature',
      'first commit',
    ]);
    await expect(git.deleteBranch(root, 'feature')).rejects.toThrow(/not fully merged/);
    await git.deleteBranch(root, 'feature', true);
    expect((await git.branches(root)).map((branch) => branch.name)).toEqual(['main']);
  });

  it('stashes with untracked files, applies, pops and drops', async () => {
    const root = await repository('stash');
    write(root, 'a.txt', 'stashed\n');
    write(root, 'extra.txt', 'extra\n');
    await git.stash(root, 'work in progress');
    expect(await files(root)).toEqual([]);
    expect(await git.stashes(root)).toEqual([{ index: 0, message: 'On main: work in progress' }]);
    await git.applyStash(root, 0);
    expect(await files(root)).toEqual(['-M a.txt', '-U extra.txt']);
    await git.discard(root, ['a.txt', 'extra.txt']);
    await git.applyStash(root, 0, true);
    expect(await git.stashes(root)).toEqual([]);
    await git.stash(root);
    await git.dropStash(root, 0);
    expect(await git.stashes(root)).toEqual([]);
  });

  it('pushes and pulls with a remote, counts ahead and behind, and reports a conflict', async () => {
    const root = await repository('local');
    const remote = join(workspace, 'remote.git');
    raw(workspace, 'init', '--bare', '-b', 'main', remote);
    raw(root, 'remote', 'add', 'origin', remote);
    expect((await git.outgoing(root)).map((commit) => commit.subject)).toEqual(['first commit']);
    await git.push(root);
    expect(await git.outgoing(root)).toEqual([]);
    expect(await git.projectStatus(root)).toMatchObject({
      upstream: 'origin/main',
      ahead: 0,
      behind: 0,
    });

    const other = join(workspace, 'other');
    raw(workspace, 'clone', '--quiet', remote, other);
    raw(other, 'config', 'user.name', 'Other');
    raw(other, 'config', 'user.email', 'other@example.com');
    write(other, 'a.txt', 'theirs\n');
    raw(other, 'commit', '--quiet', '-am', 'their change');
    raw(other, 'push', '--quiet');

    write(root, 'a.txt', 'mine\n');
    await git.commit(root, 'my change', { all: true });
    await git.fetch(root);
    expect(await git.projectStatus(root)).toMatchObject({ ahead: 1, behind: 1 });
    expect((await git.outgoing(root)).map((commit) => commit.subject)).toEqual(['my change']);

    expect(await git.mergePull(root)).toEqual({ conflicts: true });
    const status = await git.projectStatus(root);
    expect(status.merging).toBe(true);
    expect(status.files).toEqual([{ path: 'a.txt', conflicted: true }]);

    write(root, 'a.txt', 'both\n');
    await git.stage(root, ['a.txt']);
    await git.commit(root, 'merge');
    expect(await git.projectStatus(root)).toMatchObject({ merging: false, ahead: 2, behind: 0 });
    await git.push(root);
    expect(await git.projectStatus(root)).toMatchObject({ ahead: 0, behind: 0 });
    expect(await git.mergePull(root)).toEqual({ conflicts: false });

    raw(other, 'switch', '--quiet', '-c', 'topic');
    raw(other, 'push', '--quiet', '-u', 'origin', 'topic');
    await git.fetch(root);
    expect(await git.branches(root)).toEqual([
      { name: 'main', current: true, upstream: 'origin/main', remote: false },
      { name: 'origin/main', current: false, remote: true },
      { name: 'origin/topic', current: false, remote: true },
    ]);
    await git.switchBranch(root, 'origin/topic');
    expect(await git.projectStatus(root)).toMatchObject({
      branch: 'topic',
      upstream: 'origin/topic',
    });
  });

  it('stops a remote that never answers, and the repository stays usable', async () => {
    const root = await repository('hang');
    const ssh = join(workspace, 'slow-ssh.sh');
    writeFileSync(ssh, '#!/bin/sh\nsleep 30\n', { mode: 0o755 });
    raw(root, 'remote', 'add', 'origin', 'ssh://git@example.invalid/repo.git');
    raw(root, 'config', 'core.sshCommand', ssh);
    const impatient = new GitService(
      loadEnv({ NODE_ENV: 'test', FS_ROOT: workspace }, workspace),
      300,
    );
    const started = Date.now();
    await expect(impatient.push(root)).rejects.toMatchObject({ code: 'TIMEOUT' });
    await expect(impatient.fetch(root)).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(5000);
    expect((await impatient.projectStatus(root)).branch).toBe('main');
  });
});
