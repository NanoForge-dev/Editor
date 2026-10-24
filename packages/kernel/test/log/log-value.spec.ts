import { describe, expect, it } from 'vitest';

import { formatLogValue, isExpandableLogValue } from '../../src/log/format-log-value';
import { serializeLogValue } from '../../src/log/serialize-log-value';

class Position {
  constructor(
    public x = 1,
    public y = 2,
  ) {}
}

describe('serializeLogValue', () => {
  it('keeps primitives and tags what JSON cannot carry', () => {
    expect(serializeLogValue('a')).toBe('a');
    expect(serializeLogValue(1.5)).toBe(1.5);
    expect(serializeLogValue(null)).toBeNull();
    expect(serializeLogValue(undefined)).toEqual({ type: 'undefined' });
    expect(serializeLogValue(NaN)).toEqual({ type: 'number', text: 'NaN' });
    expect(serializeLogValue(-0)).toEqual({ type: 'number', text: '-0' });
    expect(serializeLogValue(10n)).toEqual({ type: 'bigint', text: '10n' });
    expect(serializeLogValue(function move() {})).toEqual({ type: 'function', text: 'ƒ move()' });
  });

  it('snapshots objects, class instances, arrays, sets and maps', () => {
    expect(serializeLogValue({ a: 1, b: [true, 'x'] })).toEqual({
      type: 'object',
      entries: [
        ['a', 1],
        ['b', { type: 'array', length: 2, items: [true, 'x'] }],
      ],
    });
    expect(serializeLogValue(new Position())).toMatchObject({ type: 'object', name: 'Position' });
    expect(serializeLogValue(new Set([1]))).toEqual({
      type: 'array',
      name: 'Set',
      length: 1,
      items: [1],
    });
    expect(serializeLogValue(new Map([['k', 1]]))).toEqual({
      type: 'map',
      size: 1,
      entries: [['k', 1]],
    });
    expect(serializeLogValue(new Float32Array([1, 2]))).toMatchObject({
      type: 'array',
      name: 'Float32Array',
      items: [1, 2],
    });
  });

  it('marks cycles and cuts deep or large values', () => {
    const loop: Record<string, unknown> = { name: 'loop' };
    loop.self = loop;
    expect(serializeLogValue(loop)).toEqual({
      type: 'object',
      entries: [
        ['name', 'loop'],
        ['self', { type: 'circular' }],
      ],
    });
    const shared = { v: 1 };
    expect(serializeLogValue([shared, shared])).toMatchObject({
      items: [{ type: 'object' }, { type: 'object' }],
    });
    expect(serializeLogValue({ a: { b: { c: 1 } } }, { depth: 2 })).toEqual({
      type: 'object',
      entries: [['a', { type: 'object', entries: [['b', { type: 'cut', text: 'Object' }]] }]],
    });
    expect(serializeLogValue([1, 2, 3], { entries: 2 })).toEqual({
      type: 'array',
      length: 3,
      items: [1, 2],
      more: 1,
    });
    expect(serializeLogValue('abcdef', { text: 3 })).toBe('abc…');
  });

  it('keeps errors with their stack, and survives throwing getters', () => {
    const error = serializeLogValue(new TypeError('bad'));
    expect(error).toMatchObject({ type: 'error', name: 'TypeError', message: 'bad' });
    const hostile = {
      get boom(): never {
        throw new Error('no');
      },
    };
    expect(serializeLogValue(hostile)).toEqual({
      type: 'object',
      entries: [['boom', '[threw Error: no]']],
    });
  });
});

describe('formatLogValue', () => {
  it('prints one line, quoting nested strings only', () => {
    expect(formatLogValue('plain')).toBe('plain');
    expect(formatLogValue(serializeLogValue({ a: 'x', b: [1, undefined] }))).toBe(
      '{ a: "x", b: [1, undefined] }',
    );
    expect(formatLogValue(serializeLogValue(new Position()))).toBe('Position { x: 1, y: 2 }');
    expect(formatLogValue(serializeLogValue(new Map([['k', 1]])))).toBe('Map(1) {"k" => 1}');
    expect(formatLogValue(serializeLogValue([1, 2, 3], { entries: 1 }))).toBe('[1, … 2 more]');
  });

  it('tells what can be expanded', () => {
    expect(isExpandableLogValue('a')).toBe(false);
    expect(isExpandableLogValue(serializeLogValue({}))).toBe(false);
    expect(isExpandableLogValue(serializeLogValue({ a: 1 }))).toBe(true);
    expect(isExpandableLogValue(serializeLogValue(new Error('x')))).toBe(true);
  });
});
