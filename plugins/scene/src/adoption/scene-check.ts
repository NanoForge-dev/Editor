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

/** `package.json` with the scene module beside the engine's core (same range). */
const withSceneModule = (text: string): string => {
  const json = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
  const sections = ['dependencies', 'devDependencies'] as const;
  if (sections.some((key) => json[key]?.[SCENE_MODULE])) return text;
  const key = sections.find((section) => json[section]?.['@nanoforge-dev/core']) ?? 'dependencies';
  const entries = { ...json[key] };
  entries[SCENE_MODULE] = entries['@nanoforge-dev/core'] ?? '*';
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
              const changeset = await recordChanges(
                io,
                `Move ${app.name}'s entities into ${className}`,
                async (memory) => {
                  await memory.write(scenePath, result.scene);
                  if (memory.exists(packageJson))
                    await memory.write(
                      packageJson,
                      withSceneModule(await memory.read(packageJson)),
                    );
                  await memory.write(entry, result.main);
                },
              );
              return {
                ...changeset,
                notes: [
                  `${SCENE_MODULE} is not on npm yet: until the engine publishes it, the project installs it from an engine checkout (linked), or its dependencies fail to install.`,
                ],
              };
            },
          },
        });
      }
      return suggestions;
    },
  });
