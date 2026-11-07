import {
  type AppModel,
  type CatalogItem,
  type HistoryCommand,
  type PluginContext,
  ProjectServiceToken,
  compositeCommand,
} from '@nanoforge-dev/editor-sdk';
import { NotificationServiceToken } from '@nanoforge-dev/editor-sdk/ui';

import {
  IMPORTERS_ANALYZER,
  RELOCATED_TEXT_ANALYZER,
  REWRITE_IMPORTS_TRANSFORMER,
} from '../model/ecs.const';
import { codeServices } from '../service/code-services';
import { ecsData } from '../service/ecs-data';
import { refactorsHistory } from './refactors-history';

/**
 * Moves or copies an item's file into an app or a shared library (ADR 0004): the file's own
 * imports follow it, and a move rewrites every import of it. One undo step ("Refactors").
 */
export const relocateItem = async (
  context: PluginContext,
  item: CatalogItem,
  target: AppModel,
  move: boolean,
): Promise<boolean> => {
  const { code, documents } = codeServices(context);
  const project = context.services.get(ProjectServiceToken).current.get();
  const notify = (title: string, detail: string) =>
    context.services.tryGet(NotificationServiceToken)?.notify('warning', title, { detail });
  if (!code || !documents || !project) return false;
  const from = item.meta.source;
  const kind = ecsData(item)?.type === 'system' ? 'systems' : 'components';
  const to = `${kind === 'systems' ? target.dirs.systems : target.dirs.components}/${from.split('/').at(-1)}`;
  const title = move ? `Move ${item.meta.export}` : `Copy ${item.meta.export}`;
  if (project.fs.entry(to)) {
    notify(`${title}: not possible`, `${to} already exists.`);
    return false;
  }
  const relocated = await code.analyze<{ text: string; imports: string[] }>(
    from,
    RELOCATED_TEXT_ANALYZER,
    { to },
  );
  if (target.type === 'lib') {
    const apps = (project.model.get().apps ?? []).filter((app) => app.type !== 'lib');
    const appImport = relocated.imports.find((path) =>
      apps.some((app) => path === app.root || path.startsWith(`${app.root}/`)),
    );
    if (appImport) {
      notify(
        `${title}: not possible`,
        `It imports ${appImport}, and a shared library can't import an app. Move that file first.`,
      );
      return false;
    }
  }
  const importers = move
    ? await code.analyze<string[]>(from, IMPORTERS_ANALYZER)
    : ([] as string[]);
  const edits: HistoryCommand[] = [];
  for (const importer of importers) {
    if (importer === from) continue;
    const command = await code.edit(
      importer,
      REWRITE_IMPORTS_TRANSFORMER,
      { from, to },
      {
        label: `Imports of ${item.meta.export}`,
      },
    );
    if (command) edits.push(command);
  }
  const original = await documents.getText(from);
  const fs = project.fs;
  const textOf = (path: string) => documents.getText(path).catch(() => undefined);
  /** Moves a file and writes its new text; a failed write moves it back. */
  const moveWith = async (source: string, target: string, text: string) => {
    await fs.rename(source, target);
    try {
      await fs.write(target, text);
    } catch (error) {
      await fs.rename(target, source).catch(() => undefined);
      throw error;
    }
  };
  let applied = false;
  const file: HistoryCommand = {
    label: `${move ? 'Move' : 'Copy'} ${from}`,
    do: async () => {
      if (move) await moveWith(from, to, relocated.text);
      else await fs.write(to, relocated.text);
      applied = true;
    },
    undo: async () => {
      if (move) await moveWith(to, from, original);
      else await fs.delete(to);
      applied = false;
    },
    isValid: async () => {
      if (applied) return (await textOf(to)) === relocated.text;
      return move ? (await textOf(from)) === original : (await textOf(to)) === undefined;
    },
  };
  const command = compositeCommand(
    move ? `${title} to ${target.name}` : `${title} into ${target.name}`,
    [file, ...edits],
  );
  try {
    await refactorsHistory(context).push(command);
    return true;
  } catch (error) {
    notify(`${title}: not possible`, error instanceof Error ? error.message : String(error));
    return false;
  }
};
