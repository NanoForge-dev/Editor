import type { CommandOrigin, HistoryCommand } from './history-command.type';
import { InvalidCommandError } from './invalid-command.exception';

export const sameOrigin = (a: CommandOrigin | undefined, b: CommandOrigin | undefined): boolean =>
  a?.kind === b?.kind && a?.id === b?.id;

const redoOf = (command: HistoryCommand) => (command.redo ?? command.do).call(command);

/**
 * Runs `step` on a command once it is still valid. A command is valid in the state it left, so
 * the commands of a group are checked one by one as their turn comes: two of them editing the
 * same file each expect the text the other left.
 */
const checked =
  (step: (command: HistoryCommand) => Promise<void> | void) =>
  async (command: HistoryCommand): Promise<void> => {
    if ((await command.isValid?.()) === false) throw new InvalidCommandError(command.label);
    await step(command);
  };

/**
 * Undo and redo of commands run in `order`: each is checked when its turn comes, and only the
 * one that runs first is checked beforehand (`isValid`). One that changed since stops the run:
 * those already run are reverted and an `InvalidCommandError` goes on.
 */
const sequence = (order: readonly HistoryCommand[]) => {
  let undone = false;
  return {
    undo: async () => {
      await runAll(
        [...order].reverse(),
        checked((command) => command.undo()),
        redoOf,
      );
      undone = true;
    },
    redo: async () => {
      await runAll(order, checked(redoOf));
      undone = false;
    },
    async isValid() {
      const first = undone ? order[0] : order.at(-1);
      return (await first?.isValid?.()) !== false;
    },
  };
};

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
  ...sequence(children),
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
  ...sequence([previous, next]),
  dispose() {
    previous.dispose?.();
    next.dispose?.();
  },
});
