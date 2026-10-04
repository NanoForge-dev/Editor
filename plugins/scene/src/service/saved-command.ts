import type { HistoryCommand } from '@nanoforge-dev/editor-sdk';

/** A command whose file is saved after it is done or undone. */
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
});
