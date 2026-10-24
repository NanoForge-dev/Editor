import { ObservableValue } from '@nanoforge-dev/editor-kernel';
import { type HistoryCommand, HistoryService } from '../../src';

/** A value with undoable "set" commands. */
export const cell = (initial: number) => {
  const state = { value: initial };
  const set = (value: number, extra: Partial<HistoryCommand> = {}): HistoryCommand => {
    let previous = 0;
    return {
      label: `set ${value}`,
      do: () => {
        previous = state.value;
        state.value = value;
      },
      undo: () => {
        state.value = previous;
      },
      ...extra,
    };
  };
  return { state, set };
};

export const setup = (options: { limit?: number; now?: () => number; budgetBytes?: number } = {}) => {
  const limit = new ObservableValue(options.limit ?? 100);
  const history = new HistoryService({
    limit,
    mergeWindowMs: new ObservableValue(500),
    ...(options.now && { now: options.now }),
    ...(options.budgetBytes !== undefined && { budgetBytes: options.budgetBytes }),
  });
  const context = history.registerContext({ id: 'scene', label: 'Scene' });
  return { history, context, stack: context.stack, limit };
};
