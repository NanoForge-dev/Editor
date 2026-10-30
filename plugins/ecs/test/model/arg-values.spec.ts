import { describe, expect, it } from 'vitest';

import type { Element } from '@nanoforge-dev/editor-sdk';

import {
  currentValue,
  defaultArg,
  enumMemberArg,
  hexColor,
  hexToRgb,
  initialArgs,
  rgbToHex,
} from '../../src/model/arg-values';

const param = (extra: object) => ({ name: 'p', ...extra }) as unknown as Element;

describe('arg values', () => {
  it("shows the argument's value, else the param's default", () => {
    expect(currentValue(param({ type: 'number', default: 3 }), undefined)).toBe(3);
    expect(currentValue(param({ type: 'number', default: 3 }), { value: 5 } as never)).toBe(5);
    expect(currentValue(param({ type: 'number' }), undefined)).toBeUndefined();
  });

  it('writes a default, the default code, undefined or a value of the type', () => {
    expect(defaultArg(param({ type: 'number', default: 2 }))).toEqual({ value: 2 });
    expect(defaultArg(param({ type: 'number', defaultCode: 'SPEED' }))).toEqual({ code: 'SPEED' });
    expect(defaultArg(param({ type: 'number', optional: true }))).toEqual({ code: 'undefined' });
    expect(defaultArg(param({ type: 'number' }))).toEqual({ value: 0 });
    expect(defaultArg(param({ type: 'boolean' }))).toEqual({ value: false });
    expect(defaultArg(param({ type: 'string', enum: ['left', 'right'] }))).toEqual({
      value: 'left',
    });
    expect(defaultArg(param({ type: 'asset' }))).toEqual({ value: '' });
    expect(defaultArg(param({ type: 'array' }))).toEqual({ value: [] });
    expect(defaultArg(param({ type: 'object' }))).toEqual({ code: 'undefined' });
  });

  it('fills the params up to the last required one', () => {
    expect(
      initialArgs([
        param({ type: 'number' }),
        param({ type: 'boolean', optional: true }),
        param({ type: 'string' }),
        param({ type: 'number', optional: true }),
      ]),
    ).toEqual([{ value: 0 }, { code: 'undefined' }, { value: '' }]);
    expect(initialArgs([param({ type: 'number', optional: true })])).toEqual([]);
  });

  it("writes an enum member with its enum's import", () => {
    expect(enumMemberArg('@nanoforge-dev/input#InputEnum', 'ArrowUp')).toEqual({
      value: { code: 'InputEnum.ArrowUp' },
      imports: [{ name: 'InputEnum', from: '@nanoforge-dev/input' }],
    });
  });

  it('converts colors', () => {
    expect(hexColor('#A0b1C2')).toBe('#A0b1C2');
    expect(hexColor('red')).toBeUndefined();
    expect(hexColor(3)).toBeUndefined();
    expect(rgbToHex(255, 0, 300)).toBe('#ff00ff');
    expect(rgbToHex(-5, 15.6, 128)).toBe('#001080');
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0]);
  });
});
