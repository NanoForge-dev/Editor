import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { analyzeLocalItems } from '../../src/worker/local-items';
import { type SplitItemsResult, analyzeSplitItems } from '../../src/worker/split-items';
import { FIXTURES, engineOf, expectTree, readTree } from '../fixtures/adoption/golden';

const SPLIT = 'adoption.split';

/** Runs a split on a tree and returns the tree it leaves. */
const splitFiles = (
  files: Map<string, string>,
  file: string,
  items: { name: string; to: string }[],
  entry = false,
) => {
  const engine = engineOf(files);
  engine.registerAnalyzer(SPLIT, analyzeSplitItems);
  const result = engine.analyze(file, SPLIT, { items, entry }) as SplitItemsResult;
  for (const { path, text } of [...result.files, ...result.importers]) files.set(path, text);
  if (result.source === null) files.delete(file);
  else files.set(file, result.source);
  return files;
};

/** Runs a split on the fixture's input and returns the tree it leaves. */
const split = (
  fixture: string,
  file: string,
  items: { name: string; to: string }[],
  entry = false,
) => splitFiles(readTree(join(FIXTURES, fixture, 'input')), file, items, entry);

const DIR = 'apps/client/src/components';
const COMPONENTS = `${DIR}/components.ts`;

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
      split(
        'split',
        'apps/client/src/main.ts',
        [
          { name: 'Gravity', to: 'apps/client/src/components/gravity.ts' },
          { name: 'fall', to: 'apps/client/src/systems/fall.ts' },
        ],
        true,
      ),
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

  it('leaves an exported helper where it is: other files import it', () => {
    const files = splitFiles(
      new Map([
        [
          COMPONENTS,
          'export const clamp = (value: number) => Math.max(0, value);\n\nexport class Position {\n  x = 0;\n}\n\nexport class Velocity {\n  x = clamp(1);\n}\n',
        ],
        [
          'apps/client/src/systems/move.ts',
          'import { clamp } from "../components/components";\n\nexport const move = () => clamp(2);\n',
        ],
      ]),
      COMPONENTS,
      [
        { name: 'Position', to: `${DIR}/position.ts` },
        { name: 'Velocity', to: `${DIR}/velocity.ts` },
      ],
    );
    expect(files.get(COMPONENTS)).toBe(
      'export const clamp = (value: number) => Math.max(0, value);\n',
    );
    expect(files.get(`${DIR}/velocity.ts`)).toBe(
      'import { clamp } from "./components";\n\nexport class Velocity {\n  x = clamp(1);\n}\n',
    );
    expect(files.get('apps/client/src/systems/move.ts')).toBe(
      'import { clamp } from "../components/components";\n\nexport const move = () => clamp(2);\n',
    );
  });

  it("keeps the file's header comment and the comments of the imports it prunes", () => {
    const files = splitFiles(
      new Map([
        [
          COMPONENTS,
          '/** Shapes of the game. */\n\n// @ts-expect-error untyped\nimport { a, b } from "./shapes";\nimport { c } from "./colors";\n\nexport class Position {\n  x = a + c;\n}\n\nexport class Velocity {\n  x = b;\n}\n\nexport const keep = a;\n',
        ],
        [`${DIR}/shapes.ts`, 'export const a = 1;\nexport const b = 2;\n'],
        [`${DIR}/colors.ts`, 'export const c = 3;\n'],
      ]),
      COMPONENTS,
      [
        { name: 'Position', to: `${DIR}/position.ts` },
        { name: 'Velocity', to: `${DIR}/velocity.ts` },
      ],
    );
    expect(files.get(COMPONENTS)).toBe(
      '/** Shapes of the game. */\n\n// @ts-expect-error untyped\nimport { a } from "./shapes";\n\nexport const keep = a;\n',
    );
  });

  it('copies imports without bindings into each new file', () => {
    const files = splitFiles(
      new Map([
        [
          COMPONENTS,
          'import "@acme/polyfill";\nimport "./register";\n\nexport class Position {\n  x = 0;\n}\n\nexport class Velocity {\n  x = 0;\n}\n',
        ],
        [`${DIR}/register.ts`, 'export {};\n'],
      ]),
      COMPONENTS,
      [
        { name: 'Position', to: `${DIR}/position.ts` },
        { name: 'Velocity', to: `apps/client/src/physics/velocity.ts` },
      ],
    );
    expect(files.has(COMPONENTS)).toBe(false);
    expect(files.get(`${DIR}/position.ts`)).toBe(
      'import "@acme/polyfill";\n\nimport "./register";\n\nexport class Position {\n  x = 0;\n}\n',
    );
    expect(files.get('apps/client/src/physics/velocity.ts')).toContain(
      'import "../components/register";',
    );
  });

  it('refuses to make items moved out of the entry file import it back', () => {
    const main =
      'import { Layer } from "@nanoforge-dev/graphics-2d";\n\nexport const layer = new Layer();\n\nexport class Sprite {\n  constructor() {\n    layer.add(this);\n  }\n}\n\nexport const main = () => new Sprite();\n';
    expect(() =>
      splitFiles(
        new Map([['apps/client/src/main.ts', main]]),
        'apps/client/src/main.ts',
        [{ name: 'Sprite', to: `${DIR}/sprite.ts` }],
        true,
      ),
    ).toThrow(/use layer of apps\/client\/src\/main.ts, which imports them/);
  });
});
