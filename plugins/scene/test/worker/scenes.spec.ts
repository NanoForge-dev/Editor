/* eslint-disable no-restricted-imports -- tests run the worker code against the real code engine */
import { describe, expect, it } from 'vitest';

import type { CodeEngine } from '@nanoforge-dev/editor-code/engine';

import type { AppScenesModel } from '../../src/model/scene-model.type';
import { SCENES_ANALYZER } from '../../src/model/scene.const';
import { MAIN, breakoutEngine } from '../fixtures/breakout';

const analyze = (engine: CodeEngine) =>
  engine.analyze(MAIN, SCENES_ANALYZER, { root: 'apps/client' }) as AppScenesModel;

describe('scene analyzer (breakout)', () => {
  it('finds the scenes, their parents, params and tags', () => {
    const model = analyze(breakoutEngine());
    expect(
      model.scenes.map((scene) => [scene.id, scene.parent ?? null, scene.ecs, scene.ownSetup]),
    ).toEqual([
      ['GameOver', null, true, true],
      ['Level1', 'Run', true, true],
      ['Level2', 'Run', true, true],
      ['Level3', 'Run', true, true],
      ['Menu', null, true, true],
      ['Pause', null, true, true],
      ['Run', null, true, true],
      ['Victory', null, true, true],
    ]);
    const gameOver = model.scenes.find((scene) => scene.id === 'GameOver')!;
    expect(gameOver.params).toEqual([
      {
        name: 'score',
        type: 'number',
        optional: false,
        description: 'The score of the game that ended.',
      },
    ]);
    const level = model.scenes.find((scene) => scene.id === 'Level1')!;
    expect(level).toMatchObject({
      path: 'apps/client/src/scenes/levels.ts',
      tagged: true,
      side: 'client',
      vars: ['level', 'bricksLeft', 'ballSpeed', 'served'],
      description: 'Level 1: three rows that break in one hit.',
    });
    expect(model.problems).toEqual([]);
  });

  it("reads SceneLibrary's initial scene and scenes", () => {
    expect(analyze(breakoutEngine()).library).toMatchObject({
      initial: 'Menu',
      hasScenes: true,
      scenes: {
        Menu: 'Menu',
        Run: 'Run',
        Level1: 'Level1',
        Level2: 'Level2',
        Level3: 'Level3',
        Pause: 'Pause',
        GameOver: 'GameOver',
        Victory: 'Victory',
      },
    });
  });

  it('names a scene by its key in scenes, and reports one missing from it', () => {
    const engine = breakoutEngine();
    const main = engine.text(MAIN)!;
    engine.setFiles([
      {
        path: MAIN,
        text: main.replace('scenes: { Menu, Run,', 'scenes: { Title: Menu,').replace(' Run,', ''),
      },
    ]);
    const model = analyze(engine);
    expect(model.scenes.find((scene) => scene.className === 'Menu')?.id).toBe('Title');
    expect(model.problems).toContain('Run is not in the scenes of SceneLibrary.');
  });
});
