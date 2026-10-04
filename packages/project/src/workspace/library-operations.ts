import type { AppModel, ProjectModel } from '@nanoforge-dev/editor-protocol';
import { withPathsEntry, withoutPathsEntry } from '@nanoforge-dev/registry/tsconfig-paths';

import { Changes } from './changes';
import { setUse } from './library-config';
import { editJson, packageJson, withWorkspaceGlob } from './workspace-files';
import { validateFolder, validatePackageName } from './workspace-queries';
import { CODE, LIB_CONFIG, TSCONFIG, WORKSPACE_CONFIG } from './workspace.const';
import { WorkspaceError } from './workspace.exception';
import type { NewLibrary, Undo, WorkspaceIo } from './workspace.type';

/**
 * A shared library: `libs/<folder>` with its config and package.json, `libs/*` in the
 * workspace's packages, a `paths` entry so it is imported by package name, and the dependency in
 * each app that uses it.
 */
export const createLibrary = (io: WorkspaceIo, library: NewLibrary): Promise<Undo> => {
  const changes = new Changes(io);
  const root = `libs/${library.folder}`;
  return changes.run(async () => {
    const invalid =
      validateFolder(io, 'libs', library.folder) ?? validatePackageName(library.packageName);
    if (invalid) throw new WorkspaceError(invalid);
    await changes.write(
      `${root}/package.json`,
      `${JSON.stringify({ name: library.packageName, version: '0.0.0', private: true, type: 'module' }, null, 2)}\n`,
    );
    await changes.write(`${root}/nanoforge.config.ts`, LIB_CONFIG);
    await changes.write(`${root}/src/components/.gitkeep`, '');
    await changes.write(`${root}/src/systems/.gitkeep`, '');
    changes.created(root);

    const tsconfig = io.exists(TSCONFIG) ? await io.read(TSCONFIG) : '{}\n';
    await changes.write(
      TSCONFIG,
      withPathsEntry(tsconfig, `${library.packageName}/*`, `./${root}/src/*`),
    );
    for (const app of library.usedBy)
      await setUse(io, changes, app, { root, name: library.packageName }, true);
    if (io.exists(WORKSPACE_CONFIG))
      await changes.write(
        WORKSPACE_CONFIG,
        withWorkspaceGlob(await io.read(WORKSPACE_CONFIG), 'libs/*'),
      );
  });
};

/**
 * Makes an app (or a library) use a shared library, or stop using it: its config's `libs` and
 * its package.json dependency.
 */
export const setLibraryUse = (
  io: WorkspaceIo,
  app: Pick<AppModel, 'root' | 'type'>,
  library: Pick<AppModel, 'root' | 'name'>,
  used: boolean,
): Promise<Undo> => {
  const changes = new Changes(io);
  return changes.run(() => setUse(io, changes, app, library, used));
};

export const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A module specifier of the library in an import, an export or a dynamic import. */
export const specifier = (library: string) =>
  new RegExp(
    `(\\bfrom\\s*|\\bimport\\s*\\(?\\s*|\\brequire\\s*\\(\\s*)(["'])${escape(library)}(/[^"']*)?\\2`,
    'g',
  );

/** The code files that import a library. */
export const libraryImporters = async (io: WorkspaceIo, library: AppModel): Promise<string[]> => {
  const importers: string[] = [];
  for (const path of io.files()) {
    if (!CODE.test(path) || path === library.root || path.startsWith(`${library.root}/`)) continue;
    if (specifier(library.name).test(await io.read(path))) importers.push(path);
  }
  return importers.sort();
};

/** A text with the imports of a library pointed at its new name; undefined when it has none. */
export const withRenamedImports = (text: string, from: string, to: string): string | undefined => {
  const renamed = text.replace(
    specifier(from),
    (_match, keyword: string, quote: string, rest: string | undefined) =>
      `${keyword}${quote}${to}${rest ?? ''}${quote}`,
  );
  return renamed === text ? undefined : renamed;
};

/**
 * Renames a shared library's package: its `package.json`, the `paths` entry, the dependencies of
 * the apps that use it, and every import of it in the project.
 */
export const renameLibrary = (
  io: WorkspaceIo,
  model: ProjectModel,
  library: AppModel,
  packageName: string,
): Promise<Undo> => {
  const changes = new Changes(io);
  return changes.run(async () => {
    const invalid = validatePackageName(packageName);
    if (invalid) throw new WorkspaceError(invalid);
    if (model.apps.some((app) => app.name === packageName))
      throw new WorkspaceError(`${packageName} is already the name of an app or library.`);
    if (io.exists(TSCONFIG)) {
      const without = withoutPathsEntry(await io.read(TSCONFIG), `${library.name}/*`);
      await changes.write(
        TSCONFIG,
        withPathsEntry(without, `${packageName}/*`, `./${library.root}/src/*`),
      );
    }
    for (const app of model.apps) {
      if (app === library || !io.exists(packageJson(app))) continue;
      await editJson(io, changes, packageJson(app), (json) => {
        for (const key of ['dependencies', 'devDependencies'] as const) {
          const entries = json[key] as Record<string, string> | undefined;
          if (!entries || !(library.name in entries)) continue;
          json[key] = Object.fromEntries(
            Object.entries(entries)
              .map(([name, range]) => [name === library.name ? packageName : name, range] as const)
              .sort(([a], [b]) => a.localeCompare(b)),
          );
        }
      });
    }
    for (const path of io.files()) {
      if (!CODE.test(path)) continue;
      const renamed = withRenamedImports(await io.read(path), library.name, packageName);
      if (renamed !== undefined) await changes.write(path, renamed);
    }
    await editJson(io, changes, packageJson(library), (json) => {
      json.name = packageName;
    });
  });
};

/**
 * Removes a shared library: its folder (to the trash), its `paths` entry and the dependencies on
 * it. Refused while code imports it: the files are named.
 */
export const removeLibrary = (
  io: WorkspaceIo,
  model: ProjectModel,
  library: AppModel,
): Promise<Undo> => {
  const changes = new Changes(io);
  return changes.run(async () => {
    const importers = await libraryImporters(io, library);
    if (importers.length) {
      throw new WorkspaceError(
        `${library.name} is imported by ${importers.length === 1 ? 'a file' : `${importers.length} files`}: remove those imports first.`,
        importers,
      );
    }
    for (const app of model.apps) {
      if (app === library || !io.exists(packageJson(app))) continue;
      await setUse(io, changes, app, library, false);
    }
    if (io.exists(TSCONFIG))
      await changes.write(
        TSCONFIG,
        withoutPathsEntry(await io.read(TSCONFIG), `${library.name}/*`),
      );
    await changes.remove(library.root);
  });
};
