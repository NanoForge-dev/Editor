import type { AppModel, ProjectModel } from '@nanoforge-dev/editor-protocol';

import { Changes } from './changes';
import { withEditorLibrary } from './editor-library';
import { type Json, editJson, packageJson, withWorkspaceGlob } from './workspace-files';
import { runnableApps, validateFolder, validatePackageName } from './workspace-queries';
import { EDITOR_LIBRARY, ENGINE_BASE, MAIN, WORKSPACE_CONFIG } from './workspace.const';
import { WorkspaceError } from './workspace.exception';
import type { NewApp, Undo, WorkspaceIo } from './workspace.type';

/**
 * A new client or server app in `apps/<folder>`: a copy of an app of the project, or an empty
 * one whose engine libraries (and their versions) are those of an app of the project. Its
 * dependencies are installed apart (a copy brings its `node_modules` with it).
 */
export const createApp = (io: WorkspaceIo, model: ProjectModel, app: NewApp): Promise<Undo> => {
  const changes = new Changes(io);
  const root = `apps/${app.folder}`;
  return changes.run(async () => {
    const invalid = validateFolder(io, 'apps', app.folder) ?? validatePackageName(app.name);
    if (invalid) throw new WorkspaceError(invalid);
    if (model.apps.some((existing) => existing.name === app.name))
      throw new WorkspaceError(`${app.name} is already the name of an app or library.`);
    if (app.from) {
      await io.copy(app.from.root, root);
      changes.created(root);
      for (const leftover of ['dist', '.nanoforge'])
        if (io.exists(`${root}/${leftover}`)) await io.remove(`${root}/${leftover}`);
      await editJson(io, changes, `${root}/package.json`, (json) => {
        json.name = app.name;
      });
    } else {
      const sibling =
        runnableApps(model).find((existing) => existing.type === app.type) ??
        runnableApps(model)[0];
      const siblingJson = sibling
        ? (JSON.parse(await io.read(packageJson(sibling))) as Json)
        : undefined;
      const known = {
        ...(siblingJson?.dependencies as Record<string, string> | undefined),
        ...(siblingJson?.devDependencies as Record<string, string> | undefined),
      };
      const devDependencies = Object.fromEntries(
        [...ENGINE_BASE, EDITOR_LIBRARY, 'typescript']
          .filter((name) => !sibling || name in known)
          .map((name) => [name, known[name] ?? '*']),
      );
      await changes.write(
        `${root}/package.json`,
        `${JSON.stringify({ name: app.name, version: '0.0.0', private: true, type: 'module', devDependencies }, null, 2)}\n`,
      );
      changes.created(root);
      await changes.write(
        `${root}/nanoforge.config.ts`,
        `import { defineConfig } from "@nanoforge-dev/config";\n\nexport default defineConfig({\n  type: "${app.type}",\n});\n`,
      );
      const tsconfig = sibling && `${sibling.root}/tsconfig.json`;
      if (tsconfig && io.exists(tsconfig))
        await changes.write(`${root}/tsconfig.json`, await io.read(tsconfig));
      const main = MAIN[app.type];
      await changes.write(
        `${root}/src/main.ts`,
        EDITOR_LIBRARY in devDependencies ? (withEditorLibrary(main) ?? main) : main,
      );
      await changes.write(`${root}/src/components/.gitkeep`, '');
      await changes.write(`${root}/src/systems/.gitkeep`, '');
    }
    if (io.exists(WORKSPACE_CONFIG))
      await changes.write(
        WORKSPACE_CONFIG,
        withWorkspaceGlob(await io.read(WORKSPACE_CONFIG), 'apps/*'),
      );
  });
};

/** Renames an app: the name in its `package.json`. */
export const renameApp = (
  io: WorkspaceIo,
  model: ProjectModel,
  app: AppModel,
  name: string,
): Promise<Undo> => {
  const changes = new Changes(io);
  return changes.run(async () => {
    const invalid = validatePackageName(name);
    if (invalid) throw new WorkspaceError(invalid);
    if (model.apps.some((existing) => existing !== app && existing.name === name))
      throw new WorkspaceError(`${name} is already the name of an app or library.`);
    await editJson(io, changes, packageJson(app), (json) => {
      json.name = name;
    });
  });
};

/** Removes an app (its folder goes to the trash). The last app of a project stays. */
export const removeApp = (io: WorkspaceIo, model: ProjectModel, app: AppModel): Promise<Undo> => {
  const changes = new Changes(io);
  return changes.run(async () => {
    if (!app.root) throw new WorkspaceError('The project is this app: it cannot be removed.');
    if (runnableApps(model).length <= 1)
      throw new WorkspaceError('A project needs at least one app.');
    await changes.remove(app.root);
  });
};
