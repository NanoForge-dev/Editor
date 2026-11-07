import { Project } from 'ts-morph';
import { expect, it } from 'vitest';

import { defaultModulePath, extractItems } from '../../src';

it('reads the doc of a first parameter written right after the parenthesis', () => {
  const file = new Project({ useInMemoryFileSystem: true }).createSourceFile(
    '/project/a.ts',
    'export class Position {\n  name = "Position";\n  constructor(/** @group Coords */ x: number, /** Top. */ y: number) {}\n}\n',
  );
  const { items } = extractItems(file, {
    source: { kind: 'app', name: 'c', path: '' },
    path: 'a.ts',
    owners: [],
    listed: true,
    modulePath: defaultModulePath,
    refOf: () => undefined,
  });
  expect(items[0]!.params).toMatchObject([
    { name: 'x', layout: { group: 'Coords' } },
    { name: 'y', description: 'Top.' },
  ]);
});
