import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { analyzeLocalItems } from '../../src/worker/local-items';
import { type SplitItemsResult, analyzeSplitItems } from '../../src/worker/split-items';
import { FIXTURES, engineOf, expectTree, readTree } from '../fixtures/adoption/golden';

const SPLIT = 'adoption.split';

/** Runs a split on the fixture's input and returns the tree it leaves. */
const split = (fixture: string, file: string, items: { name: string; to: string }[]) => {
  const files = readTree(join(FIXTURES, fixture, 'input'));
  const engine = engineOf(files);
  engine.registerAnalyzer(SPLIT, analyzeSplitItems);
  const result = engine.analyze(file, SPLIT, { items }) as SplitItemsResult;
  for (const { path, text } of [...result.files, ...result.importers]) files.set(path, text);
  if (result.source === null) files.delete(file);
  else files.set(file, result.source);
  return files;
};

describe('splitting items into files of their own', () => {
  it('splits a file of several components, each with only the imports it uses', () => {
    const dir = 'apps/client/src/components';
    expectTree(
      'split',
      split('split', `${dir}/components.ts`, [
        { name: 'Position', to: `${dir}/position.ts` },
        { name: 'Velocity', to: `${dir}/velocity.ts` },
        { name: 'CircleComponent', to: `${dir}/circle-component.ts` },
      ]),
    );
  });

  it('extracts a component and a system defined in main.ts', () => {
    expectTree(
      'extract',
      split('split', 'apps/client/src/main.ts', [
        { name: 'Gravity', to: 'apps/client/src/components/gravity.ts' },
        { name: 'fall', to: 'apps/client/src/systems/fall.ts' },
      ]),
    );
  });

  it('finds the items an entry file declares and uses, not the ones it imports', () => {
    const engine = engineOf(readTree(join(FIXTURES, 'split', 'input')));
    engine.registerAnalyzer('local', analyzeLocalItems);
    expect(engine.analyze('apps/client/src/main.ts', 'local')).toEqual({
      components: ['Gravity'],
      systems: ['fall'],
    });
  });
});
