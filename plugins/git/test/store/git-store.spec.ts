import { describe, expect, it } from 'vitest';

import type { GitStatus } from '@nanoforge-dev/editor-sdk';

import { GitStore } from '../../src/store/git-store';
import { status } from '../fixtures/status';

describe('GitStore', () => {
  const api = (value: GitStatus) => {
    const calls: string[] = [];
    return {
      calls,
      api: {
        status: async () => (calls.push('status'), value),
        branches: async () => (
          calls.push('branches'),
          [
            { name: 'main', current: true, remote: false },
            { name: 'feature', current: false, remote: false },
          ]
        ),
        stashes: async () => (calls.push('stashes'), []),
        log: async (limit: number, branch?: string) => (
          calls.push(`log ${limit}${branch ? ` ${branch}` : ''}`),
          []
        ),
      },
    };
  };

  it('reads the repository, and nothing more than the status without one', async () => {
    const store = new GitStore();
    const repo = api(status());
    store.setApi(repo.api);
    await store.refresh();
    expect(store.state.get()).toMatchObject({
      status: { branch: 'main' },
      branches: [{ name: 'main', current: true }, { name: 'feature' }],
      busy: false,
    });
    const none = api({ ...status(), repository: false, files: [] });
    store.setApi(none.api);
    await store.refresh();
    expect(new Set(none.calls)).toEqual(new Set(['status']));
    expect(store.state.get().status?.repository).toBe(false);
  });

  it('refreshes after an operation and reports a failure', async () => {
    const errors: string[] = [];
    const store = new GitStore((title, error) => errors.push(`${title}: ${String(error)}`));
    const repo = api(status());
    store.setApi(repo.api);
    await store.refresh();
    repo.calls.length = 0;
    expect(await store.run('Commit', async () => undefined)).toBe(true);
    expect(repo.calls).toContain('status');
    expect(
      await store.run('Push failed', async () => {
        throw new Error('rejected');
      }),
    ).toBe(false);
    expect(errors).toEqual(['Push failed: Error: rejected']);
    expect(store.state.get().busy).toBe(false);
  });

  it('says so in a hosted editor, and asks for more history', async () => {
    const store = new GitStore();
    store.setApi({
      ...api(status()).api,
      status: async () => {
        throw Object.assign(new Error('no'), { code: 'FORBIDDEN' });
      },
    });
    await store.refresh();
    expect(store.state.get().unavailable).toMatch(/local editors/);
    const repo = api(status());
    store.setApi(repo.api);
    await store.refresh();
    await store.showMore();
    expect(repo.calls).toContain('log 100');
    await store.showBranch('feature');
    expect(repo.calls).toContain('log 50 feature');
    await store.showBranch('gone');
    expect(store.state.get().logBranch).toBeUndefined();
  });
});
