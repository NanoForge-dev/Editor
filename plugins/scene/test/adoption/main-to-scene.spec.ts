import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CodeEngine } from '@nanoforge-dev/editor-code/engine';

import { type MainToSceneResult, analyzeMainToScene } from '../../src/worker/main-to-scene';

const FIXTURE = join(import.meta.dirname, '../fixtures/adoption/scene');
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
  it('moves the spawns and systems to a scene that main registers', () => {
    const files = readTree(join(FIXTURE, 'input'));
    const result = convert(files);
    expect(result).toMatchObject({ entities: ['circle'], systems: ['draw2D'] });
    files.set(SCENE, result.scene);
    files.set(MAIN, result.main);
    const expected = join(FIXTURE, 'expected');
    if (process.env.UPDATE_GOLDEN) {
      rmSync(expected, { recursive: true, force: true });
      for (const [path, text] of files) {
        mkdirSync(dirname(join(expected, path)), { recursive: true });
        writeFileSync(join(expected, path), text);
      }
      return;
    }
    expect(Object.fromEntries([...files].sort())).toEqual(
      Object.fromEntries([...readTree(expected)].sort()),
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
