import { describe, expect, it, vi } from 'vitest';

import { ObservableValue } from '@nanoforge-dev/editor-kernel';
import { PluginsContract } from '@nanoforge-dev/editor-protocol';

import { followProjectPlugins } from '../../src/lib/plugin/follow-project-plugins';

const setup = (trusted: boolean) => {
  const current = new ObservableValue<{ id: string; trusted: boolean } | undefined>(undefined);
  const notify = vi.fn();
  const plugins = {
    api: {
      list: async () => [],
      runProjectServers: async () => {},
      suggestions: async () => [
        { name: '@acme/physics-ui', suggestedBy: [{ package: '@acme/physics' }] },
      ],
    },
  };
  const disposable = followProjectPlugins({
    rpc: {
      api: (contract: unknown) => (contract === PluginsContract ? plugins.api : {}),
    } as never,
    projects: { current } as never,
    plugins: {
      update: async () => {},
      getPlugin: () => undefined,
      plugins: { get: () => [] },
    } as never,
    notifications: { notify } as never,
    logger: { warn: vi.fn(), error: vi.fn() } as never,
    settings: { get: () => [] } as never,
    online: false,
  });
  current.set({ id: 'pong', trusted });
  return { current, notify, disposable };
};

const suggestion = (notify: ReturnType<typeof vi.fn>) =>
  notify.mock.calls.find(([, title]) => String(title).startsWith('Packages in this project'));

describe('followProjectPlugins', () => {
  it('offers to install suggested plugins in a trusted folder', async () => {
    const { notify, disposable } = setup(true);
    await expect.poll(() => suggestion(notify)).toBeDefined();
    expect(suggestion(notify)![2].actions.map((action: { title: string }) => action.title)).toEqual(
      ['Install for this project', 'Install for me'],
    );
    disposable.dispose();
  });

  it('only names them in a folder that is not trusted, and offers them once it is', async () => {
    const { current, notify, disposable } = setup(false);
    await expect.poll(() => suggestion(notify)).toBeDefined();
    expect(suggestion(notify)![2].actions).toBeUndefined();
    expect(suggestion(notify)![2].detail).toContain('Trust this folder');

    notify.mockClear();
    current.set(undefined);
    current.set({ id: 'pong', trusted: true });
    await expect.poll(() => suggestion(notify)?.[2].actions?.length).toBe(2);
    disposable.dispose();
  });
});
