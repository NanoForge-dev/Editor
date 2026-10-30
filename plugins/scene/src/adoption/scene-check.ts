import {
  type ClientProject,
  CodeServiceToken,
  type Disposable,
  PROJECT_CHECKS,
  type PluginContext,
  type ProjectSuggestion,
  recordChanges,
  runnableApps,
  workspaceIo,
} from '@nanoforge-dev/editor-sdk';

import { MAIN_TO_SCENE_ANALYZER } from '../model/scene.const';
import { kebab } from '../template/scene-template';
import type { MainToSceneResult } from '../worker/main-to-scene';

const SCENE_MODULE = '@nanoforge-dev/scene';

type PackageJson = Record<string, Record<string, string> | undefined>;
const SECTIONS = ['dependencies', 'devDependencies'] as const;

/** A path without `.` and `..` segments (leading `..` kept), as segments. */
const segments = (path: string) => {
  const result: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..' && result.length && result.at(-1) !== '..') result.pop();
    else result.push(part);
  }
  return result;
};

/** `to` relative to the folder `from` (both relative to the project). */
const relativePath = (from: string, to: string) => {
  const a = segments(from);
  const b = segments(to);
  let common = 0;
  while (common < a.length && common < b.length && a[common] === b[common]) common++;
  return [...a.slice(common).map(() => '..'), ...b.slice(common)].join('/') || '.';
};

/**
 * The scene module's spec for the app at `appRoot`, from a `package.json` of the project that
 * declares it (a `link:` or `file:` path is rebased on the app's folder). The engine's core spec
 * is not one: the module is not on npm, and core's link points at another folder.
 */
export const sceneModuleSpec = (
  packages: readonly { readonly path: string; readonly text: string }[],
  appRoot: string,
): string | undefined => {
  for (const { path, text } of packages) {
    let json: PackageJson;
    try {
      json = JSON.parse(text) as PackageJson;
    } catch {
      continue;
    }
    const spec = SECTIONS.map((key) => json[key]?.[SCENE_MODULE]).find(Boolean);
    if (!spec) continue;
    const local = /^(link|file):(.*)$/.exec(spec);
    if (!local || local[2]!.startsWith('/')) return spec;
    const folder = path.split('/').slice(0, -1).join('/');
    return `${local[1]}:${relativePath(appRoot, `${folder}/${local[2]}`)}`;
  }
  return undefined;
};

/** `package.json` with the scene module beside the engine's core. */
export const withSceneModule = (text: string, spec: string): string => {
  const json = JSON.parse(text) as PackageJson;
  if (SECTIONS.some((key) => json[key]?.[SCENE_MODULE])) return text;
  const key = SECTIONS.find((section) => json[section]?.['@nanoforge-dev/core']) ?? 'dependencies';
  const entries = { ...json[key], [SCENE_MODULE]: spec };
  json[key] = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify(json, null, 2)}\n`;
};

/**
 * The scene plugin's check of the Adapt to the editor report: an app whose main makes its
 * entities itself, without scenes, gets them moved into a scene (`Game`) loaded at the start.
 * Offered only where `@nanoforge-dev/scene` is installed (it is not on npm yet).
 */
export const registerSceneCheck = (context: PluginContext): Disposable =>
  context.contribute(PROJECT_CHECKS, {
    id: 'scene.from-main',
    run: async (project: ClientProject): Promise<ProjectSuggestion[]> => {
      const code = context.services.tryGet(CodeServiceToken);
      if (!code) return [];
      const io = workspaceIo(project, { fresh: false });
      const suggestions: ProjectSuggestion[] = [];
      for (const app of runnableApps(project.model.get())) {
        const entry = app.entryFile;
        if (!entry || !io.exists(entry) || !app.engineLibs['@nanoforge-dev/ecs']) continue;
        if (app.engineLibs[SCENE_MODULE]) continue;
        const text = await io.read(entry);
        if (!/\.spawnEntity\(/.test(text) || /\bSceneLibrary\b/.test(text)) continue;
        /**
         * Only where the module is installed (linked from an engine checkout): it is not on npm
         * yet, and a fresh project (nf new, the tutorial's) could not install it.
         */
        if (!app.availableEngineLibs.includes(SCENE_MODULE)) continue;
        let className = 'Game';
        for (let n = 2; io.exists(`${app.dirs.scenes}/${kebab(className)}.ts`); n++)
          className = `Game${n}`;
        const scenePath = `${app.dirs.scenes}/${kebab(className)}.ts`;
        suggestions.push({
          id: `scene.from-main:${app.id}`,
          app: app.name,
          title: "Make main's entities a scene",
          detail: `${entry} makes the game's entities and systems itself: they are there for the whole game. In scenes (a menu, levels, a pause screen), each part makes its own and goes away when another is loaded, and the Scenes panel shows them. This moves them into a scene, ${className}, loaded when the game starts.`,
          fix: {
            title: 'Move into a scene',
            changeset: async () => {
              const result = await code.analyze<MainToSceneResult>(entry, MAIN_TO_SCENE_ANALYZER, {
                scenePath,
                className,
                side: app.type === 'server' ? 'server' : 'client',
              });
              const packageJson = `${app.root ? `${app.root}/` : ''}package.json`;
              const others = io
                .files()
                .filter(
                  (path) =>
                    (path === 'package.json' || path.endsWith('/package.json')) &&
                    path !== packageJson &&
                    !/(^|\/)(node_modules|nf_modules)\//.test(path),
                );
              const spec = sceneModuleSpec(
                await Promise.all(
                  others.map(async (path) => ({ path, text: await io.read(path) })),
                ),
                app.root,
              );
              const changeset = await recordChanges(
                io,
                `Move ${app.name}'s entities into ${className}`,
                async (memory) => {
                  await memory.write(scenePath, result.scene);
                  if (spec && memory.exists(packageJson))
                    await memory.write(
                      packageJson,
                      withSceneModule(await memory.read(packageJson), spec),
                    );
                  await memory.write(entry, result.main);
                },
              );
              return {
                ...changeset,
                notes: [
                  `${SCENE_MODULE} is not on npm yet: until the engine publishes it, the project installs it from an engine checkout (linked), or its dependencies fail to install.`,
                  ...(spec
                    ? []
                    : [
                        `No package.json of the project names ${SCENE_MODULE}, though it is installed: add it to ${packageJson} by hand (a link: to your engine checkout's modules/scene), or a fresh install drops it.`,
                      ]),
                ],
              };
            },
          },
        });
      }
      return suggestions;
    },
  });
