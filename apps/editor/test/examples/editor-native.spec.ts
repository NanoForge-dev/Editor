import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CODE_FILE, CodeEngine } from '@nanoforge-dev/editor-code/engine';
import type { EntryModel } from '@nanoforge-dev/editor-plugin-ecs/src/model/ecs-model.type';
import { analyzeEntry } from '@nanoforge-dev/editor-plugin-ecs/src/worker/entry-file';
import { ecsOwner } from '@nanoforge-dev/editor-plugin-ecs/src/worker/owner';
import type { AppScenesModel } from '@nanoforge-dev/editor-plugin-scene/src/model/scene-model.type';
import { SCENES_ANALYZER } from '@nanoforge-dev/editor-plugin-scene/src/model/scene.const';
import { analyzeScenes } from '@nanoforge-dev/editor-plugin-scene/src/worker/scenes';

/** The games `pnpm examples` copied. The test checks each one, and skips when there is none. */
const COPIES = join(import.meta.dirname, '../../../../.examples');
const GAMES = existsSync(COPIES)
  ? readdirSync(COPIES).filter((name) => existsSync(join(COPIES, name, 'nanoforge.config.ts')))
  : [];
const SKIPPED = new Set(['node_modules', 'dist', '.nanoforge', 'nf_modules']);
const ITEM_FILE = /src\/(components|systems)\//;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (SKIPPED.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : CODE_FILE.test(name) ? [path] : [];
  });

/** The apps of a game: `apps/*` in a workspace, the game itself otherwise (a client). */
const appsOf = (game: string) => {
  const config = readFileSync(join(game, 'nanoforge.config.ts'), 'utf8');
  if (!/type:\s*["']workspace["']/.test(config)) return [{ root: '', ref: 'app:client' }];
  return readdirSync(join(game, 'apps'))
    .filter((name) => existsSync(join(game, 'apps', name, 'nanoforge.config.ts')))
    .map((name) => ({ root: `apps/${name}`, ref: `app:${name}` }));
};

/**
 * What the editor can't model in a game: analyzer problems, entities made in code only,
 * components that resolve to no item or can't be edited, systems that resolve to no item, and
 * files of `components/` or `systems/` that hold no item.
 */
const problemsOf = async (game: string) => {
  const files = walk(game).map((file) => ({
    path: relative(game, file).split('\\').join('/'),
    text: readFileSync(file, 'utf8'),
  }));
  const engine = new CodeEngine();
  engine.setFiles(files);
  engine.registerItemOwner(ecsOwner, '@nanoforge/ecs');
  engine.registerAnalyzer('entry', analyzeEntry);
  engine.registerAnalyzer(SCENES_ANALYZER, analyzeScenes);
  const apps = appsOf(game);
  const roots = apps.map(({ root, ref }) => ({ path: root, ref }));
  const problems: string[] = [];

  for (const app of apps) {
    const prefix = app.root ? `${app.root}/` : '';
    const itemFiles = files.filter(
      (file) => file.path.startsWith(`${prefix}src/`) && ITEM_FILE.test(file.path),
    );
    const meta = await engine.extractMeta({
      source: { kind: 'app', name: app.ref.slice('app:'.length), path: app.root },
      files: itemFiles.map((file) => ({
        path: file.path,
        folder: file.path.includes('/components/') ? 'components' : 'systems',
      })),
      roots,
    });
    for (const file of itemFiles)
      if (!meta.items.some((item) => item.source === file.path))
        problems.push(`${file.path}: holds no item`);

    const main = `${prefix}src/main.ts`;
    const bodies = [{ label: main, model: engine.analyze(main, 'entry', { roots }) as EntryModel }];
    const scenes = engine.analyze(main, SCENES_ANALYZER, { root: app.root }) as AppScenesModel;
    for (const problem of scenes.problems) problems.push(`${app.root || '.'} scenes: ${problem}`);
    for (const scene of scenes.scenes.filter((scene) => scene.ownSetup))
      bodies.push({
        label: `${scene.path} ${scene.className}.setup`,
        model: engine.analyze(scene.path, 'entry', {
          roots,
          scope: { kind: 'method', class: scene.className, method: 'setup' },
        }) as EntryModel,
      });

    for (const { label, model } of bodies) {
      for (const problem of model.problems) problems.push(`${label}: ${problem}`);
      for (const code of model.codeOnly)
        problems.push(`${label}: code-only entity \`${code.code}\``);
      for (const entity of model.entities)
        for (const component of entity.components)
          if (!component.item || !component.editable)
            problems.push(
              `${label}: ${entity.name}.${component.className ?? component.code} is not modelled`,
            );
      for (const system of model.systems)
        if (!system.item)
          problems.push(`${label}: system ${system.name ?? system.code} is not modelled`);
    }
  }
  return problems;
};

describe('copied examples are editor-native', () => {
  if (!GAMES.length) it.skip('no copied example: run pnpm examples', () => undefined);
  for (const name of GAMES)
    it(`the editor models ${name}`, async () => {
      expect(await problemsOf(join(COPIES, name))).toEqual([]);
    });
});
