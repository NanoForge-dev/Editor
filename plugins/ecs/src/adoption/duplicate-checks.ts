import {
  type AppModel,
  type CatalogItem,
  type CatalogState,
  type ClientProject,
  type PluginContext,
  type ProjectSuggestion,
  createLibrary,
  librariesOf,
  recordChanges,
  setLibraryUse,
  workspaceIo,
} from '@nanoforge-dev/editor-sdk';

import {
  IMPORTERS_ANALYZER,
  REDIRECTED_IMPORTS_ANALYZER,
  RELOCATED_TEXT_ANALYZER,
} from '../model/ecs.const';
import { codeServices } from '../service/code-services';
import { ecsData } from '../service/ecs-data';

const basename = (path: string) => path.split('/').at(-1) ?? path;

/**
 * A file's code without its imports, spacing, trailing commas and quote style: two copies of a
 * component formatted differently compare equal.
 */
const essence = (text: string) =>
  text
    .replace(/^\s*import\s[\s\S]*?from\s*["'][^"']+["'];?/gm, '')
    .replace(/^\s*import\s*["'][^"']+["'];?/gm, '')
    .replace(/\s+/g, '')
    .replace(/,([)\]}])/g, '$1')
    .replace(/'/g, '"');

/** How code imports a library's file: its package name and its path under `src/` (ADR 0004). */
const librarySpecifier = (library: Pick<AppModel, 'root' | 'name'>, file: string) => {
  const prefix = `${library.root}/src/`;
  if (!file.startsWith(prefix)) return undefined;
  return `${library.name}/${file.slice(prefix.length).replace(/\.[cm]?[jt]sx?$/, '')}`;
};

/**
 * Components with the same name in several apps, each its own copy: identical copies, each alone
 * in its file, move to a shared library that all of them use (created if the project has none).
 */
export const duplicateSuggestions = async (
  context: PluginContext,
  project: ClientProject,
  state: CatalogState | undefined,
): Promise<ProjectSuggestion[]> => {
  const { code, documents } = codeServices(context);
  if (!code || !documents) return [];
  const model = project.model.get();
  const appOf = (item: CatalogItem) =>
    model.apps.find((app) => app.root === item.source.path && app.type !== 'lib');
  const items = (state?.items ?? []).filter(
    (item) =>
      !item.readonly &&
      item.source.kind === 'app' &&
      ecsData(item)?.type === 'component' &&
      appOf(item),
  );
  const perFile = new Map<string, number>();
  for (const item of state?.items ?? [])
    perFile.set(item.meta.source, (perFile.get(item.meta.source) ?? 0) + 1);
  const byName = new Map<string, CatalogItem[]>();
  for (const item of items)
    byName.set(item.meta.export, [...(byName.get(item.meta.export) ?? []), item]);

  const suggestions: ProjectSuggestion[] = [];
  for (const [name, copies] of byName) {
    const apps = [...new Set(copies.map((copy) => appOf(copy)!))];
    if (apps.length < 2) continue;
    const appNames = apps.map((app) => app.name).join(' and ');
    const base = {
      id: `ecs.duplicate:${name}`,
      title: `Share ${name}`,
      app: appNames,
    };
    const why = `${appNames} each have their own ${name}: a change to one copy is not made to the other.`;
    const crowded = copies.filter((copy) => (perFile.get(copy.meta.source) ?? 0) > 1);
    if (crowded.length) {
      suggestions.push({
        ...base,
        detail: `${why} ${crowded.map((copy) => basename(copy.meta.source)).join(' and ')} also ${crowded.length === 1 ? 'holds' : 'hold'} other items: split ${crowded.length === 1 ? 'it' : 'them'} first, then ${name} can move to a shared library.`,
      });
      continue;
    }
    const texts = await Promise.all(copies.map((copy) => documents.getText(copy.meta.source)));
    if (new Set(texts.map(essence)).size > 1) {
      suggestions.push({
        ...base,
        detail: `${why} The copies differ (${copies.map((copy) => copy.meta.source).join(', ')}): make them the same, then ${name} can move to a shared library.`,
      });
      continue;
    }
    suggestions.push({
      ...base,
      detail: `${why} In a shared library, ${apps.length === 2 ? 'both' : 'all of them'} use one ${name}, and the editor offers it to each (ADR 0004).`,
      fix: {
        title: 'Move to a shared library',
        changeset: async () => {
          const io = workspaceIo(project, { fresh: false });
          const libraries = librariesOf(project.model.get());
          const existing =
            libraries.find((library) =>
              apps.every((app) => app.libraries.includes(library.name)),
            ) ?? libraries[0];
          const scope = model.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
          const library = existing ?? {
            root: 'libs/shared',
            name: `@${scope}/shared`,
            dirs: { components: 'libs/shared/src/components' },
          };
          let target = `${library.dirs.components}/${basename(copies[0]!.meta.source)}`;
          for (let n = 2; io.exists(target); n++)
            target = `${library.dirs.components}/${basename(copies[0]!.meta.source).replace(/(\.[^.]+)$/, `-${n}$1`)}`;
          const relocated = await code.analyze<{ text: string; imports: string[] }>(
            copies[0]!.meta.source,
            RELOCATED_TEXT_ANALYZER,
            { to: target },
          );
          const appImport = relocated.imports.find((path) =>
            model.apps.some((app) => app.type !== 'lib' && path.startsWith(`${app.root}/`)),
          );
          if (appImport)
            throw new Error(
              `${name} imports ${appImport}, and a shared library can't import an app: move what it uses first.`,
            );
          const specifier = librarySpecifier(library, target);
          if (!specifier)
            throw new Error(
              `${library.name} does not keep its code in ${library.root}/src: move ${name} by hand.`,
            );
          const redirects: { path: string; text: string }[] = [];
          for (const copy of copies) {
            const importers = await code.analyze<string[]>(copy.meta.source, IMPORTERS_ANALYZER);
            for (const importer of importers.filter((path) => path !== copy.meta.source))
              redirects.push({
                path: importer,
                text: await code.analyze<string>(importer, REDIRECTED_IMPORTS_ANALYZER, {
                  from: copy.meta.source,
                  specifier,
                }),
              });
          }
          return recordChanges(io, `Move ${name} to ${library.name}`, async (memory) => {
            if (existing) {
              for (const app of apps.filter((app) => !app.libraries.includes(existing.name)))
                await setLibraryUse(memory, app, existing, true);
            } else
              await createLibrary(memory, {
                folder: 'shared',
                packageName: library.name,
                usedBy: apps,
              });
            await memory.write(target, relocated.text);
            for (const { path, text } of redirects) await memory.write(path, text);
            for (const copy of copies) await memory.remove(copy.meta.source);
          });
        },
      },
    });
  }
  return suggestions;
};
