import { describe, expect, it } from 'vitest';

import { decode, encode } from '../../src/codec/codec';

describe('codec', () => {
  it('round-trips binary, dates and plain JSON', () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 256);
    const value = { bytes, when: new Date('2026-09-26T10:00:00Z'), nested: [{ a: 1 }, null] };
    const decoded = decode<typeof value>(encode(value));
    expect(decoded.bytes).toBeInstanceOf(Uint8Array);
    expect(decoded.bytes).toEqual(bytes);
    expect(decoded.when).toEqual(value.when);
    expect(decoded.nested).toEqual(value.nested);
  });

  it('keeps objects that only look like tags if they have other keys', () => {
    expect(decode(encode({ $bin: 'x', other: 1 }))).toEqual({ $bin: 'x', other: 1 });
  });
});
