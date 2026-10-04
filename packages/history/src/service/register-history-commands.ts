import {
  type CommandRegistry,
  type ContextKeyService,
  type Disposable,
  DisposableStore,
} from '@nanoforge-dev/editor-kernel';

import { type HistoryService } from './history-service';
import { resolveUndoTarget } from './undo-target';

/**
 * Registers `history.undo` / `history.redo`. They return false when the keystroke should fall
 * through to the browser (native undo), so the keybinding layer does not prevent it.
 */
export const registerHistoryCommands = (
  commands: CommandRegistry,
  context: ContextKeyService,
  history: HistoryService,
  options: {
    /** Context undone when the focused widget has none (e.g. `layout`). */
    fallbackContext?: string;
  } = {},
): Disposable => {
  const store = new DisposableStore();
  const run = (action: 'undo' | 'redo') => async (): Promise<boolean> => {
    const target = resolveUndoTarget(context, options.fallbackContext);
    if (target.kind !== 'context') return false;
    await history[action](target.id);
    return true;
  };
  store.add(
    commands.register({
      id: 'history.undo',
      title: 'Undo',
      category: 'Edit',
      handler: run('undo'),
    }),
  );
  store.add(
    commands.register({
      id: 'history.redo',
      title: 'Redo',
      category: 'Edit',
      handler: run('redo'),
    }),
  );
  return store;
};
