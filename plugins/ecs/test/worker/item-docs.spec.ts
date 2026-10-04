/* eslint-disable no-restricted-imports -- tests run the worker code against the real code engine */
import { describe, expect, it } from 'vitest';

import { CodeEngine } from '@nanoforge-dev/editor-code/engine';
import { applyTextEdits } from '@nanoforge-dev/editor-history';

import type { ItemDocsOp } from '../../src/model/item-docs.type';
import { transformItemDocs } from '../../src/worker/item-docs';
import { ecsOwner } from '../../src/worker/owner';

const PATH = 'apps/client/src/components/position.ts';
const SOURCE = [
  '/**',
  ' * Where an entity is.',
  ' *',
  ' * @component',
  ' * @side client',
  ' */',
  'export class Position {',
  '  name = "Position";',
  '',
  '  /**',
  '   * @param x - Distance from the left edge.',
  '   */',
  '  constructor(',
  '    public x = 0,',
  '    /** Distance from the top. @deprecated use z */',
  '    public y = 0,',
  '  ) {}',
  '}',
  '',
].join('\n');

const setup = () => {
  const engine = new CodeEngine();
  engine.registerTransformer('ecs.item-docs', transformItemDocs);
  engine.registerItemOwner(ecsOwner, '@nanoforge/ecs');
  engine.setFiles([{ path: PATH, text: SOURCE }]);
  return engine;
};

const apply = (engine: CodeEngine, op: ItemDocsOp) => {
  const { text } = applyTextEdits(engine.text(PATH)!, engine.transform(PATH, 'ecs.item-docs', op));
  engine.setFiles([{ path: PATH, text }]);
  return text;
};

describe('item docs transformer (Component panel)', () => {
  it('writes groups in the header and layout tags on params, keeping other tags', async () => {
    const engine = setup();
    const text = apply(engine, {
      export: 'Position',
      groups: [{ name: 'Coords', color: '#4aa3ff', description: 'Position in pixels.' }],
      params: {
        x: { group: 'Coords', preset: 'vector.x', description: 'Distance from the left.' },
        y: { group: 'Coords', preset: 'vector.y', label: 'Top', hidden: true },
      },
    });
    expect(text).toContain(
      ' * @component\n * @side client\n * @group Coords color=#4aa3ff - Position in pixels.\n */',
    );
    expect(text).toContain(
      '    /** Distance from the left. @group Coords @preset vector.x */\n    public x = 0,',
    );
    expect(text).toContain(
      '    /** Distance from the top. @group Coords @preset vector.y @label Top @hidden @deprecated use z */',
    );
    expect(text).not.toContain('@param x');
    expect(text).toContain('  constructor(');

    const meta = await engine.extractMeta({
      source: { kind: 'app', name: 'client', path: 'apps/client' },
      files: [{ path: PATH, folder: 'components' }],
      roots: [{ path: 'apps/client', ref: 'app:client' }],
    });
    expect(meta.items[0]).toMatchObject({
      groups: [{ name: 'Coords', color: '#4aa3ff', description: 'Position in pixels.' }],
      params: [
        {
          name: 'x',
          description: 'Distance from the left.',
          layout: { group: 'Coords', preset: { id: 'vector', slot: 'x' } },
        },
        { name: 'y', layout: { group: 'Coords', label: 'Top', hidden: true }, deprecated: 'use z' },
      ],
    });
  });

  it('removes layout tags and the description of a param', () => {
    const engine = setup();
    apply(engine, { export: 'Position', params: { y: { group: 'Debug' } } });
    const text = apply(engine, { export: 'Position', params: { y: { description: '' } } });
    expect(text).toContain('    /** @deprecated use z */\n    public y = 0,');
  });

  it('updates the description and keeps the example', () => {
    const engine = setup();
    const text = apply(engine, { export: 'Position', description: 'Where it is,\nin pixels.' });
    expect(
      text.startsWith(
        '/**\n * Where it is,\n * in pixels.\n *\n * @component\n * @side client\n */',
      ),
    ).toBe(true);
  });
});

describe('item docs on one-line constructors', () => {
  it('replaces the inline doc of a first parameter instead of adding one', () => {
    const engine = new CodeEngine();
    engine.registerTransformer('ecs.item-docs', transformItemDocs);
    const path = 'apps/client/src/components/components.ts';
    engine.setFiles([
      {
        path,
        text: 'export class Position {\n  name = "Position";\n  constructor(x: number, y: number) {}\n}\n',
      },
    ]);
    const run = (op: ItemDocsOp) => {
      const { text } = applyTextEdits(
        engine.text(path)!,
        engine.transform(path, 'ecs.item-docs', op),
      );
      engine.setFiles([{ path, text }]);
      return text;
    };
    run({ export: 'Position', params: { x: { group: 'Coords' } } });
    const text = run({
      export: 'Position',
      params: { x: { group: 'Coords', preset: 'vector.x' } },
    });
    expect(text).toContain(
      'constructor(/** @group Coords @preset vector.x */ x: number, y: number)',
    );
  });
});
