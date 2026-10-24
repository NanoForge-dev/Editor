/* eslint-disable no-restricted-imports -- tests run the worker code against the real code engine */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { CODE_FILE, CodeEngine } from '@nanoforge-dev/editor-code/engine';

import { SCENES_ANALYZER } from '../../src/model/scene.const';
import { analyzeScenes } from '../../src/worker/scenes';

/** The breakout example: every scene of it is an `EcsScene`. */
export const BREAKOUT = join(import.meta.dirname, '../../../../examples/breakout');
export const MAIN = 'apps/client/src/main.ts';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    return statSync(path).isDirectory() ? walk(path) : CODE_FILE.test(name) ? [path] : [];
  });

export const breakoutEngine = () => {
  const engine = new CodeEngine();
  engine.setFiles(
    walk(join(BREAKOUT, 'apps')).map((file) => ({
      path: relative(BREAKOUT, file).split('\\').join('/'),
      text: readFileSync(file, 'utf8'),
    })),
  );
  engine.registerAnalyzer(SCENES_ANALYZER, analyzeScenes);
  return engine;
};
