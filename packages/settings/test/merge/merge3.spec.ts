import { describe, expect, it } from 'vitest';

import { merge3 } from '../../src';

describe('merge3', () => {
  it('merges non conflicting edits and reports conflicts', () => {
    const result = merge3(
      { a: 1, b: 1, c: 1, d: 1 },
      { a: 2, b: 1, c: 5, e: 1 }, // local: a changed, c changed, d removed, e added
      { a: 1, b: 3, c: 7, d: 1 }, // remote: b changed, c changed
    );
    expect(result.values).toEqual({ a: 2, b: 3, c: 5, e: 1 });
    expect(result.conflicts).toEqual([{ key: 'c', base: 1, local: 5, remote: 7 }]);
  });
});
