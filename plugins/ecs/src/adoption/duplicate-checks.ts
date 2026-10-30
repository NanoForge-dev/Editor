import {
  type AppModel,
  type CatalogItem,
  type CatalogState,
  type ClientProject,
  type PluginContext,
  type ProjectSuggestion,
  type WorkspaceIo,
  createLibrary,
  librariesOf,
  nameTaken,
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

const STRING = /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/;

/**
 * A file's code, imports included, without its spacing, trailing commas and quote style: two
 * copies of a component formatted differently compare equal. Strings are kept as they are
 * (`"Big ball"` is not `"Bigball"`).
 */
const essence = (text: string) =>
  text
    .split(STRING)
    .map((part, index) => {
      if (index % 2)
        return part.startsWith("'") && !part.includes('"') ? `"${part.slice(1, -1)}"` : part;
      return part
        .replace(/\s+/g, ' ')
        .replace(/ ?([^\w$ ]) ?/g, '$1')
        .replace(/,([)\]}])/g, '$1');
    })
    .join('')
    .trim();

/**
 * Where the shared copy goes: a library all the apps use (or the first one), else a new
 * `libs/shared` named after the project's scope (`@acme/pong` → `@acme/shared`), on a free name.
 */
const placement = (
  project: ClientProject,
  apps: readonly AppModel[],
  file: string,
  io: WorkspaceIo,
) => {
  const model = project.model.get();
  const libraries = librariesOf(model);
  const existing =
    libraries.find((library) => apps.every((app) => app.libraries.includes(library.name))) ??
    libraries[0];
  let library: Pick<AppModel, 'root' | 'name'> & { dirs: { components: string } };
  if (existing) library = existing;
  else {
    const scope = (model.name.match(/^@([^/]+)\//)?.[1] ?? model.name)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    let folder = 'shared';
    for (
      let n = 2;
      io.exists(`libs/${folder}`) || nameTaken(`@${scope}/${folder}`, model, io.exists);
      n++
    )
      folder = `shared-${n}`;
    library = {
      root: `libs/${folder}`,
      name: `@${scope}/${folder}`,
      dirs: { components: `libs/${folder}/src/components` },
    };
  }
  let target = `${library.dirs.components}/${basename(file)}`;
  for (let n = 2; io.exists(target); n++)
    target = `${library.dirs.components}/${basename(file).replace(/(\.[^.]+)$/, `-${n}$1`)}`;
  return { existing, library, target };
};

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
  const { code } = codeServices(context);
  if (!code) return [];
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
    /** Each copy as it would read in the library: its imports count, from the same folder. */
    const relocate = (to: string) =>
      Promise.all(
        copies.map((copy) =>
          code.analyze<{ text: string; imports: string[] }>(
            copy.meta.source,
            RELOCATED_TEXT_ANALYZER,
            { to },
          ),
        ),
      );
    const probe = placement(
      project,
      apps,
      copies[0]!.meta.source,
      workspaceIo(project, { fresh: false }),
    );
    const texts = (await relocate(probe.target)).map((relocated) => relocated.text);
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
          const { existing, library, target } = placement(
            project,
            apps,
            copies[0]!.meta.source,
            io,
          );
          const relocated = await relocate(target);
          const appImport = relocated
            .flatMap((copy) => copy.imports)
            .find((path) =>
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
                folder: library.root.slice('libs/'.length),
                packageName: library.name,
                usedBy: apps,
              });
            await memory.write(target, relocated[0]!.text);
            for (const { path, text } of redirects) await memory.write(path, text);
            for (const copy of copies) await memory.remove(copy.meta.source);
          });
        },
      },
    });
  }
  return suggestions;
};
