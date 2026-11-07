import { describe, expect, it } from 'vitest';

import { matchSegment } from '../../src/util/glob';

describe('matchSegment', () => {
  it('matches * as any run of characters', () => {
    expect(matchSegment('*', 'client')).toBe(true);
    expect(matchSegment('app-*', 'app-client')).toBe(true);
    expect(matchSegment('*-lib', 'app-client')).toBe(false);
    expect(matchSegment('a*b*c', 'axxbyyc')).toBe(true);
    expect(matchSegment('a.b', 'aXb')).toBe(false);
  });

  it('stays linear on patterns that make a regex backtrack', () => {
    const start = performance.now();
    expect(matchSegment(`${'a*'.repeat(30)}b`, 'a'.repeat(5000))).toBe(false);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
