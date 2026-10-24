import type { AppModel, ProjectModel } from '@nanoforge-dev/editor-protocol';

import { FOLDER, PACKAGE_NAME } from './workspace.const';
import type { WorkspaceIo } from './workspace.type';

export const validatePackageName = (name: string): string | undefined =>
  PACKAGE_NAME.test(name) ? undefined : 'A package name: lowercase, like @my-game/shared.';

/** A new folder of `libs/` or `apps/`: its name, and that it is free. */
export const validateFolder = (
  io: Pick<WorkspaceIo, 'exists'>,
  parent: 'libs' | 'apps',
  folder: string,
): string | undefined => {
  if (!FOLDER.test(folder)) return 'Use lowercase letters, digits and dashes.';
  if (io.exists(`${parent}/${folder}`)) return `${parent}/${folder} already exists.`;
  return undefined;
};

/** The shared libraries of a project. */
export const librariesOf = (model: ProjectModel): AppModel[] =>
  model.apps.filter((app) => app.type === 'lib');

/** The apps of a project that run: its clients and servers. */
export const runnableApps = (model: ProjectModel): AppModel[] =>
  model.apps.filter((app) => app.type !== 'lib');
