import { describe, expect, it, vi } from 'vitest';

import {
  type HistoryCommand,
  HistoryServiceToken,
  type PluginContext,
} from '@nanoforge-dev/editor-sdk';

import { SceneSteps } from '../../src/service/scene-steps';

vi.mock('@nanoforge-dev/editor-sdk/ui', () => ({
  NotificationServiceToken: Symbol('notifications'),
}));

/** A file and its edits, valid in the text they last left (as `DocumentService`'s). */
const file = () => {
  const state = { text: '' };
  const append = (chars: string): HistoryCommand => {
    let expected = '';
    const run = (text: string) => {
      state.text = text;
      expected = text;
    };
    return {
      label: `append ${chars}`,
      do: () => run(state.text + chars),
      undo: () => run(state.text.slice(0, -chars.length)),
      isValid: () => state.text === expected,
    };
  };
  return { state, append };
};

/** Scenes steps whose history keeps the pushed step. */
const setup = () => {
  const pushed: HistoryCommand[] = [];
  const stack = {
    push: async (command: HistoryCommand) => {
      await command.do();
      pushed.push(command);
    },
  };
  const context = {
    name: '@nanoforge/scene',
    services: {
      tryGet: (token: unknown) =>
        token === HistoryServiceToken ? { get: () => ({ stack }) } : undefined,
    },
  } as unknown as PluginContext;
  return { steps: new SceneSteps(context, () => undefined), pushed };
};

describe('SceneSteps', () => {
  it('undoes and redoes a step that edits the same file twice', async () => {
    const { steps, pushed } = setup();
    const main = file();
    expect(
      await steps.push('Rename scene', [
        async () => main.append('a'),
        async () => main.append('b'),
      ]),
    ).toBe(true);
    const step = pushed[0]!;
    expect(main.state.text).toBe('ab');
    expect(await step.isValid?.()).toBe(true);
    await step.undo();
    expect(main.state.text).toBe('');
    expect(await step.isValid?.()).toBe(true);
    await step.redo?.();
    expect(main.state.text).toBe('ab');
  });
});
