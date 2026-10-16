import { describe, expect, it } from 'vitest';

import { HistoryService } from '@nanoforge-dev/editor-history';
import {
  CommandRegistry,
  Container,
  CoreServices,
  ObservableValue,
} from '@nanoforge-dev/editor-kernel';

import { WorkspaceActions } from '../../src/lib/workspace/workspace-actions';

const setup = () => {
  const services = new Container('test');
  services.provide(CoreServices.Commands, new CommandRegistry(services));
  const history = new HistoryService();
  const current = new ObservableValue<{ id: string } | undefined>({ id: 'pong' });
  const actions = new WorkspaceActions({
    services,
    projects: { current } as never,
    rpc: {} as never,
    history,
    notifications: {} as never,
    prompts: {} as never,
    local: true,
  });
  return { actions, history, current };
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
});
