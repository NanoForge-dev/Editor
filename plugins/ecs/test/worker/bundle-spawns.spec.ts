import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { analyzeBundleSpawns } from '../../src/worker/bundle-spawns';

const BUNDLE = join(import.meta.dirname, '../fixtures/bundle.js');
const RUN = join(import.meta.dirname, '../fixtures/run-bundle.mjs');

const sitesWith = (runtime: string) => {
  const result = spawnSync(runtime, [RUN, BUNDLE], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout) as { line: number; column: number }[];
};

describe('bundle spawns (live entity → code)', () => {
  for (const runtime of ['node', 'bun']) {
    it(`maps the call sites recorded by ${runtime}`, () => {
      const sites = sitesWith(runtime);
      expect(sites).toHaveLength(5);
      const indexes = analyzeBundleSpawns({} as never, {
        bundle: readFileSync(BUNDLE, 'utf8'),
        sites,
      });
      expect(indexes).toEqual([0, 1, 1, 2, -1]);
    });
  }
});

describe('bundle spawns of a scene setup', () => {
  const bundle = [
    'class Level1 extends EcsScene {',
    '  setup(registry) {',
    '    const wall = registry.spawnEntity();',
    '    const ball = registry.spawnEntity();',
    '  }',
    '}',
    'const main = async () => {',
    '  const terrain = registry.spawnEntity();',
    '};',
  ].join('\n');

  it('counts the spawns of the method the site is in', () => {
    expect(
      analyzeBundleSpawns({} as never, {
        bundle,
        sites: [
          { line: 4, column: 27, enclosing: true },
          { line: 3, column: 27, enclosing: true },
          { line: 8, column: 27 },
          { line: 8, column: 27, enclosing: true },
        ],
      }),
    ).toEqual([1, 0, 0, 0]);
  });
});
