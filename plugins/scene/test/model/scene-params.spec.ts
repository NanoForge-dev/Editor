import { describe, expect, it } from 'vitest';

import { formatValue, parseParam } from '../../src/model/scene-params';

describe('scene params from prompts', () => {
  it('reads a value by the param type', () => {
    expect(parseParam({ type: 'number' }, '42')).toBe(42);
    expect(parseParam({ type: 'boolean' }, 'true')).toBe(true);
    expect(parseParam({ type: 'string' }, 'easy')).toBe('easy');
    expect(parseParam({ type: '{ x: number }' }, '{"x": 1}')).toEqual({ x: 1 });
    expect(parseParam({ type: "'a' | 'b'" }, 'a')).toBe('a');
  });

  it('shows a live value on one line', () => {
    expect(formatValue(3)).toBe('3');
    expect(formatValue('Run')).toBe('"Run"');
    expect(formatValue(null)).toBe('—');
    expect(formatValue({ list: Array.from({ length: 40 }, (_, i) => i) }).endsWith('…')).toBe(true);
  });
});
