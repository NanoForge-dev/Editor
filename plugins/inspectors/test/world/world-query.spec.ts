import { describe, expect, it } from 'vitest';

import { filterEntities, parseQuery } from '../../src/world/world-query';

const WORLD = [
  {
    id: 1,
    components: [
      { name: 'Position', value: { x: 120, y: 4 } },
      { name: 'Controller', value: { side: 'left' } },
    ],
  },
  {
    id: 2,
    components: [
      { name: 'Position', value: { x: 10, y: 4 } },
      { name: 'Velocity', value: { x: 3, y: 0 } },
      { name: 'Shape', value: { shape: { $class: 'Circle', radius: 8 } } },
    ],
  },
  { id: 12, components: [] },
];
const ids = (query: string) => filterEntities(WORLD, query).map((entity) => entity.id);

describe('world query', () => {
  it('parses terms', () => {
    expect(parseQuery('#12 Position.x >= 100 "left" speed')).toEqual([
      { kind: 'id', id: 12 },
      {
        kind: 'field',
        component: 'Position',
        field: 'x',
        compare: { operator: '>=', value: '100' },
      },
      { kind: 'text', text: 'left' },
      { kind: 'field', field: 'speed' },
    ]);
    expect(parseQuery('side = "left"')).toEqual([
      { kind: 'field', field: 'side', compare: { operator: '=', value: 'left' } },
    ]);
    expect(parseQuery('   ')).toEqual([]);
  });

  it('matches components, fields and ids', () => {
    expect(ids('')).toEqual([1, 2, 12]);
    expect(ids('Velocity')).toEqual([2]);
    expect(ids('veloc')).toEqual([2]);
    expect(ids('Position.x')).toEqual([1, 2]);
    expect(ids('Position.z')).toEqual([]);
    expect(ids('side')).toEqual([1]);
    expect(ids('#12')).toEqual([12]);
  });

  it('compares values, numbers as numbers', () => {
    expect(ids('Position.x > 100')).toEqual([1]);
    expect(ids('Position.x<=10')).toEqual([2]);
    expect(ids('x = 3')).toEqual([2]);
    expect(ids('x > 5')).toEqual([1, 2]);
    expect(ids('side = left')).toEqual([1]);
    expect(ids('side != left')).toEqual([]);
    expect(ids('Shape.shape = Circle')).toEqual([]);
  });

  it('needs every term, and searches quoted text everywhere', () => {
    expect(ids('Position Velocity')).toEqual([2]);
    expect(ids('Position.x > 5 Controller')).toEqual([1]);
    expect(ids('"circle"')).toEqual([2]);
    expect(ids('"radius"')).toEqual([2]);
    expect(ids('"120"')).toEqual([1]);
  });
});
