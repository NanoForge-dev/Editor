import type { CommandOrigin, HistoryCommand } from './history-command.type';

export const sameOrigin = (a: CommandOrigin | undefined, b: CommandOrigin | undefined): boolean =>
  a?.kind === b?.kind && a?.id === b?.id;

/**
 * Runs children in order and undoes them in reverse. When a child fails, the ones already run
 * are undone (best effort) before the error goes on: a step is never left half applied.
 */
export const compositeCommand = (
  label: string,
  children: readonly HistoryCommand[],
  origin?: CommandOrigin,
): HistoryCommand => ({
  label,
  ...(origin && { origin }),
  children,
  sizeBytes: children.reduce((total, child) => total + (child.sizeBytes ?? 0), 0),
  do: () => runAll(children, (child) => child.do()),
  undo: () =>
    runAll(
      [...children].reverse(),
      (child) => child.undo(),
      (child) => (child.redo ?? child.do).call(child),
    ),
  redo: () => runAll(children, (child) => (child.redo ?? child.do).call(child)),
  async isValid() {
    for (const child of children) if ((await child.isValid?.()) === false) return false;
    return true;
  },
  dispose() {
    for (const child of children) child.dispose?.();
  },
});

/**
 * Runs `step` on each command in order. If one throws, the ones already done are reverted with
 * `revert` (undo by default), last first, and the error is rethrown.
 */
const runAll = async (
  commands: readonly HistoryCommand[],
  step: (command: HistoryCommand) => Promise<void> | void,
  revert: (command: HistoryCommand) => Promise<void> | void = (command) => command.undo(),
): Promise<void> => {
  const done: HistoryCommand[] = [];
  try {
    for (const command of commands) {
      await step(command);
      done.push(command);
    }
  } catch (error) {
    for (const command of done.reverse()) {
      try {
        await revert(command);
      } catch {}
    }
    throw error;
  }
};

/**
 * Default merge of two commands with the same merge key: one step whose undo reverts both (the
 * last one first) and whose redo replays both.
 */
export const mergeCommands = (previous: HistoryCommand, next: HistoryCommand): HistoryCommand => ({
  label: next.label,
  ...(previous.origin && { origin: previous.origin }),
  sizeBytes: (previous.sizeBytes ?? 0) + (next.sizeBytes ?? 0),
  ...(next.mergeKey && { mergeKey: next.mergeKey }),
  do: () => next.do(),
  undo: () =>
    runAll(
      [next, previous],
      (command) => command.undo(),
      (command) => (command.redo ?? command.do).call(command),
    ),
  redo: () => runAll([previous, next], (command) => (command.redo ?? command.do).call(command)),
  async isValid() {
    return (await previous.isValid?.()) !== false && (await next.isValid?.()) !== false;
  },
  dispose() {
    previous.dispose?.();
    next.dispose?.();
  },
});
