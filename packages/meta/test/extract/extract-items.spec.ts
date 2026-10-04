import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { type ItemOwner, defaultModulePath, extractItems, parseDocComment } from '../../src';

const project = () => {
  const p = new Project({ useInMemoryFileSystem: true, compilerOptions: { strict: true } });
  p.createSourceFile(
    '/project/node_modules/@nanoforge-dev/input/index.d.ts',
    'export declare enum InputEnum { ArrowUp = "ArrowUp", ArrowDown = "ArrowDown" }',
  );
  return p;
};

const ecs: ItemOwner = {
  name: '@nanoforge/ecs',
  version: '0.0.0',
  schema: 1,
  tags: ['component'],
  infer: ({ declaration, context }) =>
    context.folder === 'components' && declaration.getKindName() === 'ClassDeclaration',
  claims: () => ({ fields: ['name'] }),
  extract: ({ declaration }) => ({ type: 'component', name: declaration.getName() }),
};

const extract = (text: string, folder?: 'components') => {
  const file = project().createSourceFile('/project/apps/client/src/c.ts', text);
  return extractItems(file, {
    source: { kind: 'app', name: 'client', path: 'apps/client' },
    path: 'apps/client/src/c.ts',
    owners: [ecs],
    ...(folder && { folder }),
    modulePath: defaultModulePath,
    refOf: () => undefined,
  });
};

describe('parseDocComment', () => {
  it('reads tags on one line, not inside fences', () => {
    const doc = parseDocComment('/** Distance. @group Coords @preset vector.x */');
    expect(doc.description).toBe('Distance.');
    expect(doc.tags).toEqual([
      { name: 'group', text: 'Coords' },
      { name: 'preset', text: 'vector.x' },
    ]);
    expect(parseDocComment('/**\n * @example\n * ```ts\n * @dec x\n * ```\n */').tags).toHaveLength(
      1,
    );
  });
});

describe('extractItems', () => {
  it('extracts a tagged component with enums, defaults, layout and groups', () => {
    const { items, diagnostics } = extract(`
import { InputEnum } from "@nanoforge-dev/input";
/**
 * The keys of a paddle.
 * @component
 * @side client
 * @group Keys color=#4aa3ff - Which keys move it.
 * @group Debug hidden
 */
export class Controller {
  name = "Controller";
  /** Whether up was held. */
  lastUp = false;
  constructor(
    /** Key that moves up. @group Keys @label Up key @color orange */
    public up: InputEnum = InputEnum.ArrowUp,
    /** @group Debug @hidden */
    public trail = false,
  ) {}
}`);
    expect(diagnostics).toEqual([]);
    const [item] = items;
    expect(item).toMatchObject({
      export: 'Controller',
      side: 'client',
      description: 'The keys of a paddle.',
      requires: ['@nanoforge-dev/input'],
      groups: [
        { name: 'Keys', color: '#4aa3ff', description: 'Which keys move it.' },
        { name: 'Debug', hidden: true },
      ],
      '@nanoforge/ecs': { type: 'component', name: 'Controller' },
    });
    expect(item!.params[0]).toMatchObject({
      name: 'up',
      type: 'string',
      enumRef: '@nanoforge-dev/input#InputEnum',
      default: 'ArrowUp',
      optional: true,
      description: 'Key that moves up.',
      layout: { group: 'Keys', label: 'Up key', color: 'orange' },
    });
    expect(item!.params[1]).toMatchObject({ layout: { group: 'Debug', hidden: true } });
    expect(item!.fields.map((field) => field.name)).toEqual(['lastUp']);
  });

  it('infers untagged components and skips fields set from the constructor', () => {
    const { items } = extract(
      `export class Position { name = "Position"; x: number; constructor(x: number) { this.x = x; } }
       export const helper = 1;`,
      'components',
    );
    expect(items.map((item) => item.export)).toEqual(['Position']);
    expect(items[0]!.fields).toEqual([]);
    expect(items[0]!.params).toEqual([{ name: 'x', type: 'number' }]);
  });

  it('keeps tags of a missing owner as unclaimed', () => {
    const { items } = extract('/** @tilemap layer */ export class Tiles {}');
    expect(items[0]!.unclaimedTags).toEqual({ tilemap: ['layer'] });
  });
});
