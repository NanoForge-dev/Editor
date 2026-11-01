import type { AppModel, ProjectModel } from '@nanoforge-dev/editor-protocol';

import { FOLDER, PACKAGE_NAME } from './workspace.const';
import type { WorkspaceIo } from './workspace.type';

export const validatePackageName = (name: string): string | undefined =>
  PACKAGE_NAME.test(name) ? undefined : 'A package name: lowercase, like @my-game/shared.';

/**
 * Why a package name is already taken in a project, if it is: the project's own name, another
 * app or shared library (`except`: the one being renamed), an engine library an app uses, or an
 * installed package. Imports by that name would reach the wrong code.
 */
export const nameTaken = (
  name: string,
  project: { readonly name: string; readonly apps: readonly AppModel[] },
  exists: (path: string) => boolean,
  except?: string,
): string | undefined => {
  if (name === project.name) return `${name} is the project's own name.`;
  const other = project.apps.find((app) => app.name === name && app.id !== except);
  if (other)
    return `${name} is already the name of ${other.type === 'lib' ? 'a shared library' : `the ${other.type} app`}.`;
  if (project.apps.some((app) => Object.hasOwn(app.engineLibs, name)))
    return `${name} is an engine library the project uses.`;
  if (name.startsWith('@') && exists(`nf_modules/${name}`))
    return `${name} is an installed package.`;
  return undefined;
};

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
