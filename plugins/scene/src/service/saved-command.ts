import type { HistoryCommand } from '@nanoforge-dev/editor-sdk';

/** A command whose file is saved after it is done, undone or redone. */
export const saved = (command: HistoryCommand, save: () => Promise<void>): HistoryCommand => ({
  ...command,
  do: async () => {
    await command.do();
    await save();
  },
  undo: async () => {
    await command.undo();
    await save();
  },
  redo: async () => {
    await (command.redo ?? command.do).call(command);
    await save();
  },
});
