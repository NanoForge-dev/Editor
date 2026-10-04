import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type {
  GitBranch,
  GitChange,
  GitCommit,
  GitStash,
  GitStatus,
} from '@nanoforge-dev/editor-protocol';
import { RpcError } from '@nanoforge-dev/editor-rpc';

import type { EditorEnv } from '../env/editor-env.type';
import { runProcess } from '../process/run-process';
import { KeyedMutex } from '../util/keyed-mutex';
import { redact, withToken } from './git-token';
import { parseStatus } from './parse-status';

export interface GitStatusEntry {
  readonly path: string;
  /** Two-letter porcelain code, e.g. ` M`, `??`. */
  readonly code: string;
}

/** Git CLI wrapper; operations on the same repository are serialized. */
export class GitService {
  private readonly _mutex = new KeyedMutex();

  constructor(
    private readonly _env: EditorEnv,
    /** How long a command that talks to a remote may take before it is stopped. */
    private readonly _networkTimeoutMs = 60_000,
  ) {}

  isRepository(path: string): boolean {
    return existsSync(join(path, '.git'));
  }

  /** Clones `url` into `path`, injecting a token for https remotes (GitHub style). */
  clone(url: string, path: string, token?: string): Promise<void> {
    const remote = token ? withToken(url, token) : url;
    return this._mutex.run(path, async () => {
      await this._git(this._env.fsRoot, ['clone', '--', remote, path]);
    });
  }

  pull(path: string): Promise<void> {
    return this._mutex.run(path, async () => {
      await this._git(path, ['pull', '--ff-only']);
    });
  }

  status(path: string): Promise<GitStatusEntry[]> {
    return this._mutex.run(path, async () => {
      const output = await this._git(path, ['status', '--porcelain=v1', '-z']);
      return output
        .split('\0')
        .filter(Boolean)
        .map((entry) => ({ code: entry.slice(0, 2), path: entry.slice(3) }));
    });
  }

  /** Stages everything, commits when there are changes and pushes. Returns false when clean. */
  commitAndPush(path: string, message: string, branch = 'main'): Promise<boolean> {
    return this._mutex.run(path, async () => {
      await this._git(path, ['add', '--all']);
      const staged = await this._git(path, ['diff', '--cached', '--name-only']);
      if (!staged.trim()) return false;
      await this._git(path, ['commit', '-m', message]);
      await this._git(path, ['push', '-u', 'origin', branch]);
      return true;
    });
  }

  /** The state of a folder's repository; `repository: false` when it has none of its own. */
  projectStatus(path: string): Promise<GitStatus> {
    if (!this.isRepository(path)) {
      return Promise.resolve({
        repository: false,
        ahead: 0,
        behind: 0,
        merging: false,
        files: [],
      });
    }
    return this._mutex.run(path, async () => {
      const output = await this._git(path, [
        'status',
        '--porcelain=v2',
        '--branch',
        '-z',
        '--untracked-files=all',
      ]);
      return { ...parseStatus(output), merging: existsSync(join(path, '.git', 'MERGE_HEAD')) };
    });
  }

  init(path: string): Promise<void> {
    return this._run(path, ['init', '-b', 'main']);
  }

  stage(path: string, paths: readonly string[]): Promise<void> {
    return this._run(path, ['add', '-A', '--', ...paths]);
  }

  unstage(path: string, paths: readonly string[]): Promise<void> {
    return this._run(path, ['reset', '-q', '--', ...paths]);
  }

  /**
   * Rolls files back to the last commit: changed and deleted files are restored (staged or
   * not), a file added since stays on disk but leaves the index, an untracked one is deleted.
   */
  discard(path: string, paths: readonly string[]): Promise<void> {
    return this._mutex.run(path, async () => {
      const list = async (args: string[]) =>
        new Set((await this._git(path, args)).split('\0').filter(Boolean));
      const hasHead =
        (await this._exec(path, ['rev-parse', '--verify', '--quiet', 'HEAD'])).exitCode === 0;
      const committed = hasHead
        ? await list(['ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', ...paths])
        : new Set<string>();
      const indexed = await list(['ls-files', '-z', '--', ...paths]);
      const restore = paths.filter((file) => committed.has(file));
      const forget = paths.filter((file) => !committed.has(file) && indexed.has(file));
      const remove = paths.filter((file) => !committed.has(file) && !indexed.has(file));
      if (restore.length) {
        await this._git(path, [
          'restore',
          '--source=HEAD',
          '--staged',
          '--worktree',
          '--',
          ...restore,
        ]);
      }
      if (forget.length) await this._git(path, ['rm', '--cached', '-q', '-f', '--', ...forget]);
      if (remove.length) await this._git(path, ['clean', '-f', '-d', '-q', '--', ...remove]);
    });
  }

  /**
   * Commits `paths` only (the rest of what is staged stays out of the commit), the staged
   * changes when there are no `paths`, or everything with `all`.
   */
  commit(
    path: string,
    message: string,
    options: { all?: boolean; paths?: readonly string[]; amend?: boolean } = {},
  ): Promise<void> {
    return this._mutex.run(path, async () => {
      const { all = false, paths, amend = false } = options;
      const merging = existsSync(join(path, '.git', 'MERGE_HEAD'));
      if (all) await this._git(path, ['add', '-A']);
      else if (paths?.length) {
        const indexed = new Set(
          (await this._git(path, ['ls-files', '-z', '--', ...paths])).split('\0').filter(Boolean),
        );
        const addable = paths.filter((file) => indexed.has(file) || existsSync(join(path, file)));
        if (addable.length) await this._git(path, ['add', '-A', '--', ...addable]);
      }
      await this._git(path, [
        'commit',
        '-q',
        '-m',
        message,
        ...(amend ? ['--amend'] : []),
        ...(paths?.length && !all && !merging ? ['--', ...paths] : []),
      ]);
    });
  }

  fetch(path: string): Promise<void> {
    return this._mutex.run(path, async () => {
      await this._git(path, ['fetch', '--prune', '--quiet'], true);
    });
  }

  /** A merge pull. Resolves with `conflicts` when it stopped on conflicts. */
  mergePull(path: string): Promise<{ conflicts: boolean }> {
    return this._mutex.run(path, async () => {
      try {
        await this._git(path, ['pull', '--no-rebase', '--no-edit', '--quiet'], true);
        return { conflicts: false };
      } catch (error) {
        if (existsSync(join(path, '.git', 'MERGE_HEAD'))) return { conflicts: true };
        throw error;
      }
    });
  }

  /** Pushes the current branch; its first push sets `origin` as its upstream. */
  push(path: string): Promise<void> {
    return this._mutex.run(path, async () => {
      const branch = (await this._git(path, ['symbolic-ref', '--short', 'HEAD'])).trim();
      const upstream = await this._git(path, [
        'for-each-ref',
        '--format=%(upstream:short)',
        `refs/heads/${branch}`,
      ]);
      await this._git(
        path,
        upstream.trim() ? ['push', '--quiet'] : ['push', '--quiet', '-u', 'origin', branch],
        true,
      );
    });
  }

  branches(path: string): Promise<GitBranch[]> {
    return this._mutex.run(path, async () => {
      const output = await this._git(path, [
        'for-each-ref',
        '--format=%(refname)%00%(refname:short)%00%(HEAD)%00%(upstream:short)',
        'refs/heads',
        'refs/remotes',
      ]);
      const branches = output
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('\0'))
        .filter(([ref = '']) => !/^refs\/remotes\/.*\/HEAD$/.test(ref))
        .map(([ref = '', name = '', head, upstream]): GitBranch => ({
          name,
          current: head === '*',
          ...(upstream && { upstream }),
          remote: ref.startsWith('refs/remotes/'),
        }));
      if (branches.some((branch) => !branch.remote)) return branches;
      const unborn = await this._git(path, ['symbolic-ref', '--short', 'HEAD']).catch(() => '');
      return unborn.trim()
        ? [{ name: unborn.trim(), current: true, remote: false }, ...branches]
        : branches;
    });
  }

  /** Switches to a local branch; a remote's branch (`origin/x`) becomes a local one tracking it. */
  switchBranch(path: string, name: string): Promise<void> {
    return this._mutex.run(path, async () => {
      const remote =
        (await this._exec(path, ['rev-parse', '--verify', '--quiet', `refs/remotes/${name}`]))
          .exitCode === 0;
      const local = remote ? name.slice(name.indexOf('/') + 1) : name;
      const exists =
        (await this._exec(path, ['rev-parse', '--verify', '--quiet', `refs/heads/${local}`]))
          .exitCode === 0;
      await this._git(
        path,
        remote && !exists
          ? ['switch', '--quiet', '--track', '-c', local, name]
          : ['switch', '--quiet', local],
      );
    });
  }

  createBranch(path: string, name: string, from?: string): Promise<void> {
    return this._run(path, ['switch', '--quiet', '-c', name, ...(from ? [from] : [])]);
  }

  deleteBranch(path: string, name: string, force = false): Promise<void> {
    return this._run(path, ['branch', '--quiet', force ? '-D' : '-d', name]);
  }

  log(path: string, limit = 50, skip = 0, branch?: string): Promise<GitCommit[]> {
    return this._mutex.run(path, async () => {
      const head = await this._git(path, ['rev-parse', '--verify', '--quiet', 'HEAD']).catch(
        () => '',
      );
      if (!head.trim()) return [];
      const output = await this._git(path, [
        'log',
        `--max-count=${limit}`,
        `--skip=${skip}`,
        '--format=%H%x00%h%x00%an%x00%at%x00%D%x00%s%x1e',
        ...(branch ? [branch, '--'] : []),
      ]);
      return output
        .split('\x1e')
        .map((record) => record.replace(/^\n/, ''))
        .filter(Boolean)
        .map((record): GitCommit => {
          const [hash = '', shortHash = '', author = '', time, refs = '', subject = ''] =
            record.split('\0');
          return {
            hash,
            shortHash,
            author,
            time: Number(time),
            refs: refs
              .split(', ')
              .map((ref) => ref.replace(/^HEAD -> /, ''))
              .filter((ref) => ref && ref !== 'HEAD'),
            subject,
          };
        });
    });
  }

  /** Commits of the current branch its upstream does not have yet (every commit without one). */
  async outgoing(path: string): Promise<GitCommit[]> {
    const { upstream, ahead } = await this.projectStatus(path);
    if (upstream) return ahead ? this.log(path, Math.min(ahead, 200), 0) : [];
    return this.log(path, 200, 0);
  }

  commitFiles(path: string, hash: string): Promise<{ path: string; change: GitChange }[]> {
    return this._mutex.run(path, async () => {
      const output = await this._git(path, [
        'show',
        '--name-status',
        '--format=',
        '-z',
        '--find-renames',
        hash,
      ]);
      const parts = output.split('\0').filter(Boolean);
      const files: { path: string; change: GitChange }[] = [];
      for (let index = 0; index < parts.length; index++) {
        const code = parts[index]![0];
        if (code === 'R' || code === 'C') {
          files.push({ path: parts[index + 2] ?? '', change: code === 'R' ? 'R' : 'A' });
          index += 2;
        } else {
          files.push({
            path: parts[++index] ?? '',
            change: code === 'A' ? 'A' : code === 'D' ? 'D' : 'M',
          });
        }
      }
      return files;
    });
  }

  /** Text of a file at `HEAD`, in the index (`INDEX`) or before a commit (`<hash>^`). */
  show(path: string, file: string, revision: string): Promise<string | null> {
    return this._mutex.run(path, async () => {
      const spec = revision === 'INDEX' ? `:${file}` : `${revision}:${file}`;
      const result = await this._exec(path, ['show', spec]);
      return result.exitCode === 0 ? result.stdout : null;
    });
  }

  stashes(path: string): Promise<GitStash[]> {
    return this._mutex.run(path, async () => {
      const output = await this._git(path, ['stash', 'list', '--format=%gs']);
      return output
        .split('\n')
        .filter(Boolean)
        .map((message, index) => ({ index, message }));
    });
  }

  stash(path: string, message?: string): Promise<void> {
    return this._run(path, [
      'stash',
      'push',
      '--include-untracked',
      '--quiet',
      ...(message ? ['-m', message] : []),
    ]);
  }

  applyStash(path: string, index: number, pop = false): Promise<void> {
    return this._run(path, ['stash', pop ? 'pop' : 'apply', '--quiet', `stash@{${index}}`]);
  }

  dropStash(path: string, index: number): Promise<void> {
    return this._run(path, ['stash', 'drop', '--quiet', `stash@{${index}}`]);
  }

  private _run(path: string, args: string[]): Promise<void> {
    return this._mutex.run(path, async () => {
      await this._git(path, args);
    });
  }

  /**
   * `network`: the command talks to a remote. It is stopped after a while (a remote that never
   * answers must not hold the repository's queue), and ssh never waits for a passphrase or a
   * host confirmation in the terminal the editor was started from.
   */
  private async _exec(cwd: string, args: string[], network = false) {
    const batchSsh =
      network &&
      !process.env.GIT_SSH_COMMAND &&
      !process.env.GIT_SSH &&
      !(await this._configured(cwd, 'core.sshCommand'));
    return runProcess(this._env.gitPath, args, {
      cwd,
      env: {
        GIT_TERMINAL_PROMPT: '0',
        GIT_CEILING_DIRECTORIES: dirname(cwd),
        LC_ALL: 'C',
        ...(batchSsh && { GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' }),
      },
      ...(network && { signal: AbortSignal.timeout(this._networkTimeoutMs) }),
    }).done;
  }

  private async _configured(cwd: string, key: string): Promise<boolean> {
    const result = await this._exec(cwd, ['config', '--get', key]).catch(() => undefined);
    return result?.exitCode === 0 && result.stdout.trim() !== '';
  }

  private async _git(cwd: string, args: string[], network = false): Promise<string> {
    let result;
    try {
      result = await this._exec(cwd, args, network);
    } catch (error) {
      if (network && (error as { name?: string }).name === 'AbortError') {
        throw new RpcError(
          'TIMEOUT',
          `git ${args[0]} got no answer from the remote in ${Math.round(this._networkTimeoutMs / 1000)} s. ` +
            'If it needs a password or a passphrase, run it once in a terminal.',
        );
      }
      throw error;
    }
    if (result.exitCode !== 0) {
      const stderr = redact(result.stderr || result.stdout).trim();
      const reason = stderr.replace(/^(error|fatal): /gm, '').slice(0, 600);
      throw new RpcError('INTERNAL', reason || `git ${args[0]} failed`, {
        stderr: stderr.slice(0, 2000),
      });
    }
    return result.stdout;
  }
}
