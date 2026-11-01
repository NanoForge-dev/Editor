import { type Container, CoreServices, type Disposable } from '@nanoforge-dev/editor-kernel';
import {
  type ClientProject,
  PROJECT_CHECKS,
  type ProjectSuggestion,
  addEditorLibrary,
  librariesOf,
  libraryImporters,
  recordChanges,
  runnableApps,
  setLibraryUse,
  workspaceIo,
} from '@nanoforge-dev/editor-project';
import type { SessionInfo } from '@nanoforge-dev/editor-protocol';

import type { WorkspaceActions } from '../workspace/workspace-actions';

const under = (root: string, path: string) => !root || path.startsWith(`${root}/`);

/** Apps that register no `EditorLibrary`: the game plays without the bridge. */
const editorLibrary = async (project: ClientProject): Promise<ProjectSuggestion[]> => {
  const io = workspaceIo(project, { fresh: false });
  const suggestions: ProjectSuggestion[] = [];
  for (const app of runnableApps(project.model.get())) {
    if (!app.entryFile || !io.exists(app.entryFile) || !app.engineLibs['@nanoforge-dev/core'])
      continue;
    if (/\bEditorLibrary\b/.test(await io.read(app.entryFile))) continue;
    suggestions.push({
      id: `core.editor-library:${app.id}`,
      app: app.name,
      title: 'Register the editor library',
      detail: `Without @nanoforge-dev/editor-lib, ${app.name} plays without the editor bridge: no Pause, Step or Stop, and the World, Profiler and Network panels stay empty. This adds it to ${app.entryFile} and to package.json.`,
      fix: {
        title: 'Add the editor library',
        changeset: () =>
          recordChanges(io, `Add the editor library to ${app.name}`, (memory) =>
            addEditorLibrary(memory, app),
          ),
      },
    });
  }
  return suggestions;
};

/** Apps whose code imports a shared library their `libs` does not list (ADR 0004). */
const unlistedLibraries = async (project: ClientProject): Promise<ProjectSuggestion[]> => {
  const io = workspaceIo(project, { fresh: false });
  const model = project.model.get();
  const suggestions: ProjectSuggestion[] = [];
  for (const library of librariesOf(model).filter((candidate) => !candidate.unclaimed)) {
    const importers = await libraryImporters(io, library);
    for (const app of runnableApps(model)) {
      if (app.libraries.includes(library.name)) continue;
      const files = importers.filter((path) => under(app.root, path));
      if (!files.length) continue;
      suggestions.push({
        id: `core.libs:${app.id}:${library.name}`,
        app: app.name,
        title: `List ${library.name} in libs`,
        detail: `${files.slice(0, 3).join(', ')}${files.length > 3 ? ` and ${files.length - 3} more` : ''} import ${library.name}, but ${app.name}'s nanoforge.config does not list it in libs: the editor does not offer its components and systems in ${app.name}. This lists it, and adds it to package.json.`,
        fix: {
          title: 'List it in libs',
          changeset: () =>
            recordChanges(io, `Use ${library.name} in ${app.name}`, (memory) =>
              setLibraryUse(memory, app, library, true),
            ),
        },
      });
    }
  }
  return suggestions;
};

/** No `node_modules`: no engine types, no builds (local editors only). */
const dependencies = async (
  project: ClientProject,
  workspace: WorkspaceActions,
): Promise<ProjectSuggestion[]> => {
  const apps = runnableApps(project.model.get());
  const installed = (root: string) =>
    project.fs.entry(root ? `${root}/node_modules` : 'node_modules') !== undefined;
  if (installed('') || apps.some((app) => installed(app.root)))
    return missingLibraries(project, workspace);
  return [
    {
      id: 'core.install',
      title: 'Install the dependencies',
      detail:
        "The project has no node_modules: the code editor knows nothing of the engine, and the game can neither build nor play. This runs the project's package manager.",
      action: { title: 'Install dependencies', run: () => workspace.install() },
    },
  ];
};

/** Engine modules not on npm yet: installed from an engine checkout (linked). */
const UNPUBLISHED = new Set(['@nanoforge-dev/scene', '@nanoforge-dev/editor-lib']);

/** Engine libraries an app declares and its node_modules lack: builds and types fail. */
const missingLibraries = (
  project: ClientProject,
  workspace: WorkspaceActions,
): ProjectSuggestion[] =>
  runnableApps(project.model.get())
    .filter((app) => app.missingEngineLibs.length)
    .map((app) => {
      const names = app.missingEngineLibs;
      const unpublished = names.filter((name) => UNPUBLISHED.has(name));
      return {
        id: `core.missing-libs:${app.id}:${names.join(',')}`,
        app: app.name,
        title:
          names.length === 1 ? `Install ${names[0]}` : `Install ${names.length} engine libraries`,
        detail: `${app.name}'s package.json needs ${names.join(', ')}, and they are not installed: the game can't build, and the code editor knows nothing of ${names.length === 1 ? 'its' : 'their'} types.${
          unpublished.length
            ? ` ${unpublished.join(' and ')} ${unpublished.length === 1 ? 'is' : 'are'} not on npm yet: link ${unpublished.length === 1 ? 'it' : 'them'} from an engine checkout (the engine's modules folder) until the engine publishes ${unpublished.length === 1 ? 'it' : 'them'}.`
            : ''
        }`,
        action: { title: 'Install dependencies', run: () => workspace.install() },
      };
    });

/** The checks the editor itself makes (`PROJECT_CHECKS`). */
export const registerCoreChecks = (
  services: Container,
  session: SessionInfo,
  workspace: WorkspaceActions,
): Disposable => {
  const extensions = services.get(CoreServices.Extensions);
  const contribute = (id: string, run: (project: ClientProject) => Promise<ProjectSuggestion[]>) =>
    extensions.contribute(PROJECT_CHECKS, { id, run }, { owner: 'core' });
  const registrations = [
    contribute('core.editor-library', editorLibrary),
    contribute('core.libs', unlistedLibraries),
    ...(session.mode === 'OFFLINE'
      ? [contribute('core.install', (project) => dependencies(project, workspace))]
      : []),
  ];
  return { dispose: () => registrations.forEach((registration) => registration.dispose()) };
};
