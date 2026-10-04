/* eslint-disable no-restricted-imports -- tests run the worker code against the real code engine */
import { describe, expect, it } from 'vitest';

import type { CodeEngine } from '@nanoforge-dev/editor-code/engine';
import { applyTextEdits } from '@nanoforge-dev/editor-history';

import { VARS_ANALYZER, VARS_TRANSFORMER } from '../../src/model/scene.const';
import type { VarsModel, VarsOp } from '../../src/model/vars-model.type';
import { analyzeVars, transformVars } from '../../src/worker/vars';
import { MAIN, breakoutEngine } from '../fixtures/breakout';

const VARS = 'apps/client/src/scene-vars.ts';

const engine = () => {
  const code = breakoutEngine();
  code.registerAnalyzer(VARS_ANALYZER, analyzeVars);
  code.registerTransformer(VARS_TRANSFORMER, transformVars);
  return code;
};

const analyze = (code: CodeEngine) =>
  code.analyze(MAIN, VARS_ANALYZER, { root: 'apps/client' }) as VarsModel;

const apply = (code: CodeEngine, op: VarsOp) => {
  const before = code.text(VARS)!;
  const { text } = applyTextEdits(before, code.transform(VARS, VARS_TRANSFORMER, op));
  code.setFiles([{ path: VARS, text }]);
  const a = before.split('\n');
  const b = text.split('\n');
  return {
    removed: a.filter((line) => !b.includes(line)),
    added: b.filter((line) => !a.includes(line)),
  };
};

describe('vars analyzer (breakout)', () => {
  it('reads SceneVars with their docs and defaults', () => {
    const model = analyze(engine());
    expect(model.file).toBe(VARS);
    expect(model.vars.map((field) => field.name)).toEqual([
      'best',
      'score',
      'lives',
      'level',
      'bricksLeft',
      'ballSpeed',
      'served',
      'paused',
    ]);
    expect(model.vars.find((field) => field.name === 'lives')).toMatchObject({
      type: 'number',
      default: '3',
      description: 'Balls left in the current game (made by `Run`).',
    });
  });

  it('finds the uses of each key, with the scene they are in', () => {
    const { uses } = analyze(engine());
    const lives = uses.filter((use) => use.key === 'lives');
    expect(
      lives.map((use) => [use.kind, use.className ?? null, use.path.split('/').at(-1)]),
    ).toEqual(
      expect.arrayContaining([
        ['init', 'Run', 'run.ts'],
        ['get', null, 'levels.ts'],
        ['set', null, 'lose-ball.ts'],
      ]),
    );
    const init = lives.find((use) => use.kind === 'init')!;
    expect(init.valueType).toBe('number');
    expect(engine().text(init.path)!.slice(init.start, init.end)).toBe('lives');
  });
});

describe('vars transformer', () => {
  it('adds, updates, renames and removes a var', () => {
    const code = engine();
    expect(
      apply(code, {
        kind: 'addVar',
        name: 'combo',
        type: 'number',
        description: 'Bricks in a row.',
        default: '0',
      }).added,
    ).toEqual(['    /** Bricks in a row. @default 0 */', '    combo: number;']);
    expect(
      apply(code, { kind: 'updateVar', name: 'combo', rename: 'streak', default: '1' }).added,
    ).toEqual(['    /** Bricks in a row. @default 1 */', '    streak: number;']);
    expect(apply(code, { kind: 'removeVar', name: 'streak' }).removed).toEqual([
      '    /** Bricks in a row. @default 1 */',
      '    streak: number;',
    ]);
    expect(analyze(code).vars).toHaveLength(8);
  });
});
