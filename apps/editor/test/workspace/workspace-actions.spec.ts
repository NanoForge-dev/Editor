import { describe, expect, it, vi } from 'vitest';

import { DocumentServiceToken } from '@nanoforge-dev/editor-code';
import { HistoryService } from '@nanoforge-dev/editor-history';
import {
  CommandRegistry,
  Container,
  CoreServices,
  ObservableValue,
} from '@nanoforge-dev/editor-kernel';

import { WorkspaceActions } from '../../src/lib/workspace/workspace-actions';

const setup = (current = new ObservableValue<unknown>({ id: 'pong' })) => {
  const services = new Container('test');
  services.provide(CoreServices.Commands, new CommandRegistry(services));
  const history = new HistoryService();
  const notify = vi.fn();
  const actions = new WorkspaceActions({
    services,
    projects: { current } as never,
    rpc: {} as never,
    history,
    notifications: { notify } as never,
    prompts: {} as never,
    local: true,
  });
  return { actions, history, current, services, notify };
};

describe('WorkspaceActions', () => {
  it('starts a new Project history when another project opens', async () => {
    const { actions, history, current } = setup();
    const stack = history.get('project')!.stack;
    await stack.push({ label: 'Add app', do: () => {}, undo: () => {} });
    expect(stack.state.canUndo).toBe(true);

    current.set({ id: 'pong' });
    await Promise.resolve();
    expect(stack.state.canUndo).toBe(true);

    current.set({ id: 'breakout' });
    await expect.poll(() => stack.state.canUndo).toBe(false);
    actions.dispose();
  });

  it('refuses to write over a document with unsaved changes', async () => {
    const path = 'apps/client/src/main.ts';
    const write = vi.fn();
    const project = {
      id: 'pong',
      fs: {
        entries: [{ path, kind: 'file' }],
        entry: (candidate: string) => (candidate === path ? { path, kind: 'file' } : undefined),
        readText: async () => ({ text: 'main();\n' }),
        write,
        refresh: async () => {},
      },
    };
    const { actions, services, notify } = setup(new ObservableValue<unknown>(project));
    const applyEdits = vi.fn();
    const save = vi.fn();
    services.provide(DocumentServiceToken, {
      get: (uri: string) =>
        uri === path
          ? { getText: () => 'main(); edited();\n', dirty: new ObservableValue(true) }
          : undefined,
      dirtyUris: [path],
      applyEdits,
      save,
    } as never);

    const applied = await actions.applyChangeset({
      title: 'Add the editor library',
      files: [{ path, before: 'main();\n', after: 'main();\napp.use(lib);\n' }],
    });

    expect(applied).toBe(false);
    expect(notify).toHaveBeenCalledWith(
      'error',
      'Add the editor library: not possible',
      expect.objectContaining({ detail: expect.stringContaining(`${path} has unsaved changes`) }),
    );
    expect(applyEdits).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    actions.dispose();
  });
});
