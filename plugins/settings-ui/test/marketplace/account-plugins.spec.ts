import { afterEach, describe, expect, it, vi } from 'vitest';

import { RegistryContract, SessionContract } from '@nanoforge-dev/editor-sdk';

import { followAccountPlugins } from '../../src/marketplace/account-plugins';
import { ACCOUNT_PLUGINS } from '../../src/marketplace/marketplace';

type Action = { title: string; run: () => unknown };

const setup = ({ mode = 'OFFLINE', failing = [] as string[] } = {}) => {
  let list: Record<string, string> = {
    '@acme/a': '^1.0.0',
    '@acme/b': '^1.0.0',
    '@acme/c': '^1.0.0',
  };
  const listeners = new Set<(event: { keys: Set<string> }) => void>();
  const settings = {
    get: () => list,
    set: vi.fn(async (_key: string, value: Record<string, string>) => {
      list = value;
    }),
    onDidChange: (listener: (event: { keys: Set<string> }) => void) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  };
  const installPlugin = vi.fn(async ({ name }: { name: string }) => {
    if (failing.includes(name)) throw new Error('not in the registry');
  });
  const rpc = {
    api: (contract: unknown) =>
      contract === RegistryContract
        ? { installPlugin }
        : contract === SessionContract
          ? { info: async () => ({ mode }) }
          : undefined,
  };
  const host = {
    plugins: {
      get: () => [
        { name: '@acme/a', descriptor: { manifest: { version: '1.0.0' }, source: 'installed' } },
      ],
    },
  };
  const notify = vi.fn();
  const follow = followAccountPlugins({
    rpc: rpc as never,
    settings: settings as never,
    host: host as never,
    notifications: { notify } as never,
    delay: 10,
  });
  const actions = (call: number) => (notify.mock.calls[call]?.[2] as { actions: Action[] }).actions;
  const changeList = (next: Record<string, string>) => {
    list = next;
    for (const listener of listeners) listener({ keys: new Set([ACCOUNT_PLUGINS]) });
  };
  return { follow, notify, installPlugin, settings, actions, changeList };
};

afterEach(() => vi.useRealTimers());

describe('followAccountPlugins', () => {
  it('names the plugins of the account missing here once, and installs them', async () => {
    vi.useFakeTimers();
    const { notify, installPlugin, actions, changeList, follow } = setup({ failing: ['@acme/c'] });
    await vi.advanceTimersByTimeAsync(10);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]?.[1]).toBe('2 plugins of your account are not installed here');
    changeList({ '@acme/b': '^1.0.0', '@acme/c': '^1.0.0' });
    expect(notify).toHaveBeenCalledTimes(1);
    await actions(0)
      .find((action) => action.title === 'Install')!
      .run();
    expect(installPlugin.mock.calls.map(([call]) => call)).toEqual([
      { name: '@acme/b', scope: 'user' },
      { name: '@acme/c', scope: 'user' },
    ]);
    expect(notify.mock.calls.map((call) => call[1])).toEqual([
      '2 plugins of your account are not installed here',
      'Some plugins could not be installed',
      'Plugins installed: reload the editor to finish',
    ]);
    follow.dispose();
  });

  it('removes them from the account when asked', async () => {
    vi.useFakeTimers();
    const { actions, settings } = setup();
    await vi.advanceTimersByTimeAsync(10);
    await actions(0)
      .find((action) => action.title === 'Remove from my account')!
      .run();
    expect(settings.set).toHaveBeenCalledWith(ACCOUNT_PLUGINS, { '@acme/a': '^1.0.0' }, 'account');
  });

  it('offers nothing in a hosted editor', async () => {
    vi.useFakeTimers();
    const { notify } = setup({ mode: 'ONLINE' });
    await vi.advanceTimersByTimeAsync(100);
    expect(notify).not.toHaveBeenCalled();
  });
});
