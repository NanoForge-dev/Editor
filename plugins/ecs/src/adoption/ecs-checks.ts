import {
  type AppModel,
  type CatalogItem,
  type CatalogState,
  type ClientProject,
  type Disposable,
  type Observable,
  PROJECT_CHECKS,
  type PluginContext,
  type ProjectSuggestion,
  recordChanges,
  workspaceIo,
} from '@nanoforge-dev/editor-sdk';

import { kebab } from '../create/create-item';
import { IMPORTERS_ANALYZER, LOCAL_ITEMS_ANALYZER, SPLIT_ITEMS_ANALYZER } from '../model/ecs.const';
import { codeServices } from '../service/code-services';
import { ecsData } from '../service/ecs-data';
import type { LocalItems } from '../worker/local-items';
import type { SplitItemsResult } from '../worker/split-items';
import { duplicateSuggestions } from './duplicate-checks';

const basename = (path: string) => path.split('/').at(-1) ?? path;
const list = (names: readonly string[]) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/** Resolves once the catalog has read every source (or after a while). */
const loaded = (catalog: Observable<CatalogState | undefined>, timeoutMs = 20_000) =>
  new Promise<CatalogState | undefined>((resolve) => {
    const done = (state: CatalogState | undefined) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(state);
    };
    const timer = setTimeout(() => done(catalog.get()), timeoutMs);
    const unsubscribe = catalog.subscribe((state) => {
      if (state && !state.loading) queueMicrotask(() => done(state));
    });
  });

/**
 * The ECS plugin's checks of the "Adapt to the editor" report: components and systems defined in
 * an entry file, several items in one file (both moved to files of their own), and item files
 * that import the entry file (report only).
 */
export const registerEcsChecks = (
  context: PluginContext,
  catalog: Observable<CatalogState | undefined>,
): Disposable => {
  const run = async (project: ClientProject): Promise<ProjectSuggestion[]> => {
    const { code } = codeServices(context);
    if (!code) return [];
    const state = await loaded(catalog);
    const apps = project.model.get().apps;
    const io = workspaceIo(project, { fresh: false });
    const suggestions: ProjectSuggestion[] = [];
    const planned = new Set<string>();
    /** A free path for an item's own file. */
    const target = (dir: string, name: string) => {
      let path = `${dir}/${kebab(name)}.ts`;
      for (let n = 2; io.exists(path) || planned.has(path); n++)
        path = `${dir}/${kebab(name)}-${n}.ts`;
      planned.add(path);
      return path;
    };
    const split = (title: string, file: string, items: { name: string; to: string }[]) => () =>
      code.analyze<SplitItemsResult>(file, SPLIT_ITEMS_ANALYZER, { items }).then((result) =>
        recordChanges(io, title, async (memory) => {
          for (const { path, text } of [...result.files, ...result.importers])
            await memory.write(path, text);
          if (result.source === null) await memory.remove(file);
          else await memory.write(file, result.source);
        }),
      );

    for (const app of apps.filter((candidate) => candidate.type !== 'lib')) {
      const entry = app.entryFile;
      if (!entry || !io.exists(entry)) continue;
      const local = await code.analyze<LocalItems>(entry, LOCAL_ITEMS_ANALYZER);
      const names = [...local.components, ...local.systems];
      if (names.length) {
        const items = [
          ...local.components.map((name) => ({ name, to: target(app.dirs.components, name) })),
          ...local.systems.map((name) => ({ name, to: target(app.dirs.systems, name) })),
        ];
        suggestions.push({
          id: `ecs.extract:${entry}`,
          app: app.name,
          title: `Move ${names.length === 1 ? names[0] : `${names.length} items`} out of ${basename(entry)}`,
          detail: `${list(names)} ${names.length === 1 ? 'is' : 'are'} defined in ${entry}. The editor finds components and systems in their own files: it can't list ${names.length === 1 ? 'it' : 'them'} in the Components panel, document ${names.length === 1 ? 'it' : 'them'} in the Inspector, nor move ${names.length === 1 ? 'it' : 'them'} to a shared library. This gives each a file of its own.`,
          fix: {
            title: 'Move to files of their own',
            changeset: split(`Move ${list(names)} out of ${basename(entry)}`, entry, items),
          },
        });
      }
      const importers = await code.analyze<string[]>(entry, IMPORTERS_ANALYZER);
      const itemFiles = new Set((state?.items ?? []).map((item) => item.meta.source));
      for (const file of importers.filter((path) => itemFiles.has(path)))
        suggestions.push({
          id: `ecs.imports-entry:${file}`,
          app: app.name,
          title: `${basename(file)} imports ${basename(entry)}`,
          detail: `${file} holds components or systems and imports the app's entry file (${entry}): they can't move to a shared library, and loading them runs main's module. Move what they use from it (a layer, a constant) to a module of its own.`,
        });
    }

    const byFile = new Map<string, CatalogItem[]>();
    for (const item of state?.items ?? []) {
      const type = ecsData(item)?.type;
      if (item.readonly || (type !== 'component' && type !== 'system')) continue;
      if (item.source.kind !== 'app' && item.source.kind !== 'lib') continue;
      byFile.set(item.meta.source, [...(byFile.get(item.meta.source) ?? []), item]);
    }
    for (const [file, items] of byFile) {
      if (items.length < 2) continue;
      const app: AppModel | undefined = apps.find(
        (candidate) => candidate.root === items[0]!.source.path,
      );
      if (!app) continue;
      const names = items.map((item) => item.meta.export);
      suggestions.push({
        id: `ecs.split:${file}`,
        app: app.name,
        title: `Split ${basename(file)}`,
        detail: `${list(names)} share ${file}. In files of their own, each can be moved to a shared library, renamed or removed alone, and its file says what it is.`,
        fix: {
          title: 'Split into one file each',
          changeset: split(
            `Split ${basename(file)}`,
            file,
            items.map((item) => ({
              name: item.meta.export,
              to: target(
                ecsData(item)?.type === 'system' ? app.dirs.systems : app.dirs.components,
                item.meta.export,
              ),
            })),
          ),
        },
      });
    }
    suggestions.push(...(await duplicateSuggestions(context, project, state)));
    return suggestions;
  };
  return context.contribute(PROJECT_CHECKS, { id: 'ecs.items', run });
};
