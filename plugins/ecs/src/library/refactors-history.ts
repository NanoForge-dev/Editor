import {
  type HistoryCommand,
  HistoryServiceToken,
  type PluginContext,
} from '@nanoforge-dev/editor-sdk';

import { REFACTORS_HISTORY } from '../service/ecs-data';

/** The "Refactors" undo context (moves, copies, new libraries). */
export const refactorsHistory = (
  context: PluginContext,
): { push(command: HistoryCommand): Promise<void> } => {
  const history = context.services.tryGet(HistoryServiceToken);
  const refactors = history
    ? (history.get(REFACTORS_HISTORY) ??
      history.registerContext({
        id: REFACTORS_HISTORY,
        label: 'Refactors',
        owner: context.name,
      }))
    : undefined;
  return {
    push: async (command) => {
      if (refactors) await refactors.stack.push(command);
      else await command.do();
    },
  };
};
