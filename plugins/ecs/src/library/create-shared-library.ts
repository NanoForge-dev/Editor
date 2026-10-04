import {
  type HistoryCommand,
  type PluginContext,
  ProjectServiceToken,
  createLibrary,
  runnableApps,
  workspaceIo,
} from '@nanoforge-dev/editor-sdk';
import { NotificationServiceToken } from '@nanoforge-dev/editor-sdk/ui';

import { refactorsHistory } from './refactors-history';

/** Creates a shared library (ADR 0004): one undo step in the Refactors history. */
export const createSharedLibrary = async (
  context: PluginContext,
  folder: string,
  packageName: string,
): Promise<boolean> => {
  const project = context.services.get(ProjectServiceToken).current.get();
  if (!project) return false;
  let undo: (() => Promise<void>) | undefined;
  const command: HistoryCommand = {
    label: `New shared library ${packageName}`,
    do: async () => {
      undo = await createLibrary(workspaceIo(project), {
        folder,
        packageName,
        usedBy: runnableApps(project.model.get()),
      });
    },
    undo: async () => {
      await undo?.();
    },
  };
  try {
    await refactorsHistory(context).push(command);
    return true;
  } catch (error) {
    context.services
      .tryGet(NotificationServiceToken)
      ?.notify('error', 'Could not create the shared library', {
        detail: error instanceof Error ? error.message : String(error),
      });
    return false;
  }
};
