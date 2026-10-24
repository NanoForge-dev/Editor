import { describe, expect, it } from 'vitest';

import { indexAt, linePath, niceMax } from '../../../src/widgets/chart/chart-scale';

describe('chart math', () => {
  it('rounds the top of an axis up', () => {
    expect([0, 0.3, 1, 1.2, 4, 16.7, 60, 730].map(niceMax)).toEqual([
      1, 0.5, 1, 2, 5, 20, 100, 1000,
    ]);
  });

  it('draws a line right-aligned while the history fills up', () => {
    expect(linePath([0, 5, 10], 100, 50, 10)).toBe('M0.0,50.0L50.0,25.0L100.0,0.0');
    expect(linePath([10], 100, 50, 10, 5)).toBe('M100.0,0.0');
    expect(linePath([0, 20], 100, 50, 10, 5)).toBe('M75.0,50.0L100.0,0.0');
    expect(linePath([], 100, 50, 10)).toBe('');
  });

  it('finds the value under the pointer', () => {
    expect(indexAt(0, 100, 3)).toBe(0);
    expect(indexAt(60, 100, 3)).toBe(1);
    expect(indexAt(100, 100, 3)).toBe(2);
    expect(indexAt(100, 100, 2, 5)).toBe(1);
    expect(indexAt(10, 100, 2, 5)).toBeUndefined();
    expect(indexAt(10, 100, 0)).toBeUndefined();
  });
});
