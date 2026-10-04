/* eslint-disable no-restricted-imports -- tests run the worker code against the real code engine */
import { describe, expect, it } from 'vitest';

import type { CodeEngine } from '@nanoforge-dev/editor-code/engine';
import { applyTextEdits } from '@nanoforge-dev/editor-history';

import type { LibraryOp, ReferenceRange, SceneFileOp } from '../../src/model/scene-model.type';
import {
  LIBRARY_TRANSFORMER,
  REFERENCES_ANALYZER,
  REPLACE_TRANSFORMER,
  SCENE_FILE_TRANSFORMER,
} from '../../src/model/scene.const';
import {
  analyzeReferences,
  transformLibrary,
  transformReplace,
  transformSceneFile,
} from '../../src/worker/edits';
import { MAIN, breakoutEngine } from '../fixtures/breakout';

const LEVELS = 'apps/client/src/scenes/levels.ts';
const PAUSE = 'apps/client/src/scenes/pause.ts';

const engine = () => {
  const code = breakoutEngine();
  code.registerTransformer(LIBRARY_TRANSFORMER, transformLibrary);
  code.registerTransformer(SCENE_FILE_TRANSFORMER, transformSceneFile);
  code.registerTransformer(REPLACE_TRANSFORMER, transformReplace);
  code.registerAnalyzer(REFERENCES_ANALYZER, analyzeReferences);
  return code;
};

const apply = (code: CodeEngine, path: string, transformer: string, op: unknown) => {
  const before = code.text(path)!;
  const { text } = applyTextEdits(before, code.transform(path, transformer, op));
  code.setFiles([{ path, text }]);
  const a = before.split('\n');
  const b = text.split('\n');
  return {
    removed: a.filter((line) => !b.includes(line)),
    added: b.filter((line) => !a.includes(line)),
  };
};

describe('SceneLibrary transformer', () => {
  it('adds a scene to scenes, with its import, and removes it', () => {
    const code = engine();
    const added = apply(code, MAIN, LIBRARY_TRANSFORMER, {
      kind: 'addScene',
      className: 'Bonus',
      from: 'apps/client/src/scenes/bonus.ts',
    } satisfies LibraryOp);
    expect(added.added).toEqual([
      'import { Bonus } from "./scenes/bonus";',
      '      scenes: { Menu, Run, Level1, Level2, Level3, Pause, GameOver, Victory, Bonus },',
    ]);
    const removed = apply(code, MAIN, LIBRARY_TRANSFORMER, {
      kind: 'removeScene',
      className: 'Bonus',
    } satisfies LibraryOp);
    expect(removed.removed).toEqual(added.added);
  });

  it('sets the initial scene', () => {
    expect(
      apply(engine(), MAIN, LIBRARY_TRANSFORMER, {
        kind: 'setInitial',
        className: 'Level1',
        from: LEVELS,
      } satisfies LibraryOp),
    ).toEqual({ removed: ['      initial: Menu,'], added: ['      initial: Level1,'] });
  });

  it('refuses to remove the initial scene', () => {
    expect(() =>
      engine().transform(MAIN, LIBRARY_TRANSFORMER, { kind: 'removeScene', className: 'Menu' }),
    ).toThrow('Menu is the initial scene');
  });
});

describe('scene file transformer', () => {
  it('gives a scene a parent, with its import, and takes it back', () => {
    const code = engine();
    const set = apply(code, PAUSE, SCENE_FILE_TRANSFORMER, {
      kind: 'setParent',
      className: 'Pause',
      parent: { className: 'Run', from: 'apps/client/src/scenes/run.ts' },
    } satisfies SceneFileOp);
    expect(set.added).toEqual(['import { Run } from "./run";', '  static override parent = Run;']);
    const unset = apply(code, PAUSE, SCENE_FILE_TRANSFORMER, {
      kind: 'setParent',
      className: 'Pause',
    } satisfies SceneFileOp);
    expect(unset.removed).toEqual(set.added);
  });

  it('writes undefined over a parent a base class gives', () => {
    expect(
      apply(engine(), LEVELS, SCENE_FILE_TRANSFORMER, {
        kind: 'setParent',
        className: 'Level2',
      } satisfies SceneFileOp).added,
    ).toEqual(['  static override parent = undefined;']);
  });

  it('removes a class with its doc', () => {
    const { removed } = apply(engine(), LEVELS, SCENE_FILE_TRANSFORMER, {
      kind: 'removeClass',
      className: 'Level3',
    } satisfies SceneFileOp);
    expect(removed).toContain(
      ' * Level 3: bricks that take two hits, faster still. The last level.',
    );
    expect(removed).toContain('export class Level3 extends Level {');
  });
});

describe('rename references', () => {
  it('finds every reference of a scene class in the project', () => {
    const code = engine();
    const references = code.analyze(PAUSE, REFERENCES_ANALYZER, {
      className: 'Pause',
    }) as ReferenceRange[];
    expect(references.map((reference) => reference.path).sort()).toEqual([
      'apps/client/src/main.ts',
      'apps/client/src/scenes/levels.ts',
      PAUSE,
    ]);
    for (const { path, ranges } of references)
      apply(code, path, REPLACE_TRANSFORMER, { ranges, text: 'Halt' });
    expect(code.text(MAIN)).toContain('import { Halt } from "./scenes/pause";');
    expect(code.text(MAIN)).toContain('Level3, Halt, GameOver');
    expect(code.text(PAUSE)).toContain('export class Halt extends EcsScene');
    expect(code.text(PAUSE)).toContain('ctx.scenes.unload(ctx, Halt)');
  });
});
