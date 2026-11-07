import {
  type PluginContext,
  ProjectServiceToken,
  libraryImporters,
  runnableApps,
  workspaceIo,
} from '@nanoforge-dev/editor-sdk';

import { RELOCATED_TEXT_ANALYZER } from '../model/ecs.const';
import { codeServices } from '../service/code-services';

/**
 * The import problems of the shared libraries: a library importing an app, libraries importing
 * each other, an app importing a library it does not use. Undefined without a project or code.
 */
export const checkLibraries = async (context: PluginContext): Promise<string[] | undefined> => {
  const { code } = codeServices(context);
  const project = context.services.get(ProjectServiceToken).current.get();
  if (!code || !project) return undefined;
  const apps = project.model.get().apps;
  const libraries = apps.filter((app) => app.type === 'lib');
  if (!libraries.length) {
    return [];
  }
  const ownerOf = (path: string) =>
    apps.find((app) => app.root && (path === app.root || path.startsWith(`${app.root}/`)));
  const problems: string[] = [];
  const edges = new Map<string, Set<string>>();
  for (const library of libraries) {
    const files = project.fs.entries.filter(
      (entry) =>
        entry.kind === 'file' &&
        /\.[cm]?[jt]sx?$/.test(entry.path) &&
        entry.path.startsWith(`${library.root}/`),
    );
    for (const file of files) {
      const { imports } = await code
        .analyze<{ imports: string[] }>(file.path, RELOCATED_TEXT_ANALYZER, { to: file.path })
        .catch(() => ({ imports: [] as string[] }));
      for (const target of imports) {
        const owner = ownerOf(target);
        if (!owner || owner === library) continue;
        if (owner.type !== 'lib')
          problems.push(`${file.path} imports ${target}: a shared library can't import an app.`);
        else edges.set(library.name, (edges.get(library.name) ?? new Set()).add(owner.name));
      }
    }
  }
  const visit = (name: string, path: string[]): string[] | undefined => {
    if (path.includes(name)) return [...path.slice(path.indexOf(name)), name];
    for (const next of edges.get(name) ?? []) {
      const cycle = visit(next, [...path, name]);
      if (cycle) return cycle;
    }
    return undefined;
  };
  for (const library of libraries) {
    const cycle = visit(library.name, []);
    if (cycle) {
      problems.push(`Shared libraries import each other: ${cycle.join(' → ')}.`);
      break;
    }
  }
  const io = workspaceIo(project);
  for (const library of libraries) {
    const importers = await libraryImporters(io, library).catch(() => [] as string[]);
    for (const app of runnableApps(project.model.get())) {
      if (app.libraries.includes(library.name)) continue;
      const file = importers.find((path) => path.startsWith(`${app.root}/`));
      if (file)
        problems.push(
          `${file} imports ${library.name}, which ${app.name} does not use: tick ${app.name} under "Used by" on the Project screen.`,
        );
    }
  }
  return problems;
};
