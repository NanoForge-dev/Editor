import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CodeEngine } from '@nanoforge-dev/editor-code/engine';

import { type MainToSceneResult, analyzeMainToScene } from '../../src/worker/main-to-scene';

const FIXTURES = join(import.meta.dirname, '../fixtures/adoption');
const FIXTURE = join(FIXTURES, 'scene');
const MAIN = 'apps/client/src/main.ts';
const SCENE = 'apps/client/src/scenes/game.ts';

const readTree = (root: string) => {
  const files = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.set(relative(root, path), readFileSync(path, 'utf8'));
    }
  };
  walk(root);
  return files;
};

const convert = (files: Map<string, string>) => {
  const engine = new CodeEngine();
  engine.setFiles([...files].map(([path, text]) => ({ path, text })));
  engine.registerAnalyzer('scene', analyzeMainToScene);
  return engine.analyze(MAIN, 'scene', {
    scenePath: SCENE,
    className: 'Game',
    side: 'client',
  }) as MainToSceneResult;
};

describe("main's entities into a scene", () => {
  /** Converts a tree and compares it with the fixture's `expected` (`UPDATE_GOLDEN=1` writes it). */
  const expectConverted = (fixture: string, files: Map<string, string>) => {
    const result = convert(files);
    files.set(SCENE, result.scene);
    files.set(MAIN, result.main);
    const expected = join(FIXTURES, fixture, 'expected');
    if (process.env.UPDATE_GOLDEN) {
      rmSync(expected, { recursive: true, force: true });
      for (const [path, text] of files) {
        mkdirSync(dirname(join(expected, path)), { recursive: true });
        writeFileSync(join(expected, path), text);
      }
      return result;
    }
    expect(Object.fromEntries([...files].sort())).toEqual(
      Object.fromEntries([...readTree(expected)].sort()),
    );
    return result;
  };

  it('moves the spawns and systems to a scene that main registers', () => {
    const result = expectConverted('scene', readTree(join(FIXTURE, 'input')));
    expect(result).toMatchObject({ entities: ['circle'], systems: ['draw2D'] });
  });

  it("keeps the registry's own name, and the comments of the statements it moves", () => {
    expectConverted('registry-alias', readTree(join(FIXTURES, 'registry-alias', 'input')));
  });

  it('replaces a registry used without a variable where it occurs', () => {
    const files = readTree(join(FIXTURE, 'input'));
    files.set(
      MAIN,
      files
        .get(MAIN)!
        .replace('  const registry = ecs.registry;\n\n', '')
        .replaceAll('registry.', 'ecs.registry.'),
    );
    expectConverted('scene', files);
  });

  it('refuses entities that use what main exports: main imports the scene', () => {
    const files = readTree(join(FIXTURE, 'input'));
    files.set(
      MAIN,
      files
        .get(MAIN)!
        .replace('export const main', 'export const SIZE = 500;\n\nexport const main')
        .replace('new Position2D(500, 500)', 'new Position2D(SIZE, 500)'),
    );
    expect(() => convert(files)).toThrow(
      /use SIZE of apps\/client\/src\/main.ts, which imports the scene/,
    );
  });

  it("refuses entities that use main's own variables", () => {
    const files = readTree(join(FIXTURE, 'input'));
    files.set(
      MAIN,
      files.get(MAIN)!.replace('new Position2D(500, 500)', 'new Position2D(app.width, 500)'),
    );
    expect(() => convert(files)).toThrow(/use app, made in main itself/);
  });

  it('refuses when main keeps using an entity it made', () => {
    const files = readTree(join(FIXTURE, 'input'));
    files.set(
      MAIN,
      files.get(MAIN)!.replace('  await app.run();', '  console.log(circle);\n  await app.run();'),
    );
    expect(() => convert(files)).toThrow(/main still uses circle/);
  });
});
