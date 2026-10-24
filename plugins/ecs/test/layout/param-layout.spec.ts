import { describe, expect, it } from 'vitest';

import type { Element } from '@nanoforge-dev/editor-sdk';

import { buildLayout } from '../../src/layout/param-layout';

const number = (name: string, layout?: Element['layout']): Element => ({
  type: 'number',
  name,
  ...(layout && { layout }),
});

describe('buildLayout', () => {
  const params: Element[] = [
    number('x', { group: 'Coords', preset: { id: 'vector', slot: 'x' } }),
    number('y', { group: 'Coords', preset: { id: 'vector', slot: 'y' } }),
    number('z', { label: 'Layer', color: 'orange' }),
    { type: 'boolean', name: 'trail', layout: { group: 'Debug', hidden: true } },
    { type: 'string', name: 'tint', layout: { preset: { id: 'color' } } },
  ];
  const groups = [
    { name: 'Coords', color: '#4aa3ff', description: 'Where.' },
    { name: 'Debug', hidden: true },
  ];

  it('merges a group preset into one row named after the group', () => {
    const layout = buildLayout(params, groups);
    expect(layout.warnings).toEqual([]);
    expect(layout.blocks.map((block) => block.kind)).toEqual(['group', 'param', 'group', 'param']);
    const coords = layout.blocks[0]!;
    expect(coords).toMatchObject({ kind: 'group', group: { name: 'Coords', color: '#4aa3ff' } });
    expect(coords.kind === 'group' && coords.rows).toMatchObject([
      {
        kind: 'preset',
        label: 'Coords',
        slots: [
          { slot: 'x', index: 0 },
          { slot: 'y', index: 1 },
        ],
      },
    ]);
    expect(layout.blocks[1]).toMatchObject({ kind: 'param', label: 'Layer', color: 'orange' });
    expect(layout.blocks[3]).toMatchObject({ kind: 'param', preset: 'color' });
  });

  it('lists hidden groups and params, and shows the ones chosen', () => {
    expect(buildLayout(params, groups).hidden).toEqual([{ id: 'group:Debug', label: 'Debug' }]);
    const shown = buildLayout(params, groups, new Set(['group:Debug']));
    expect(shown.hidden).toEqual([{ id: 'param:trail', label: 'trail' }]);
    expect(buildLayout(params, groups, new Set(['group:Debug', 'param:trail'])).hidden).toEqual([]);
  });

  it('falls back to plain fields when a preset is incomplete', () => {
    const layout = buildLayout([number('x', { preset: { id: 'vector', slot: 'x' } })], []);
    expect(layout.blocks).toMatchObject([{ kind: 'param', element: { name: 'x' } }]);
    expect(layout.warnings).toEqual(['The preset "vector" needs the slots x, y.']);
  });
});
