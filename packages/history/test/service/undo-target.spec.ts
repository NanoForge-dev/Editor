import { describe, expect, it } from 'vitest';

import { CommandRegistry, Container, ContextKeyService } from '@nanoforge-dev/editor-kernel';

import {
  HISTORY_CONTEXT_KEY,
  HistoryService,
  TEXT_INPUT_FOCUS_KEY,
  registerHistoryCommands,
} from '../../src';
import { cell } from '../fixtures/history';

describe('undo routing', () => {
  it('targets the focused context and leaves text inputs to the browser', async () => {
    const history = new HistoryService();
    const scene = history.registerContext({ id: 'scene', label: 'Scene' }).stack;
    const layout = history.registerContext({ id: 'layout', label: 'Layout' }).stack;
    const a = cell(0);
    const b = cell(0);
    await scene.push(a.set(1));
    await layout.push(b.set(1));

    const context = new ContextKeyService();
    const commands = new CommandRegistry(new Container(), context);
    registerHistoryCommands(commands, context, history);

    context.set(HISTORY_CONTEXT_KEY, 'layout');
    expect(await commands.execute('history.undo')).toBe(true);
    expect([a.state.value, b.state.value]).toEqual([1, 0]);

    context.set(TEXT_INPUT_FOCUS_KEY, true);
    expect(await commands.execute('history.undo')).toBe(false); // native undo
    context.set(TEXT_INPUT_FOCUS_KEY, false);
    context.set(HISTORY_CONTEXT_KEY, 'scene');
    await commands.execute('history.undo');
    expect(a.state.value).toBe(0);
    context.delete(HISTORY_CONTEXT_KEY);
    expect(await commands.execute('history.redo')).toBe(false);
  });

  it('falls back to a default context when the focused widget has none', async () => {
    const history = new HistoryService();
    const layout = history.registerContext({ id: 'layout', label: 'Layout' }).stack;
    const value = cell(0);
    await layout.push(value.set(3));
    const context = new ContextKeyService();
    const commands = new CommandRegistry(new Container(), context);
    registerHistoryCommands(commands, context, history, { fallbackContext: 'layout' });
    await commands.execute('history.undo');
    expect(value.state.value).toBe(0);
  });
});
