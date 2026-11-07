import { describe, expect, it } from 'vitest';

import { relativeTime } from '../../src/model/relative-time';

describe('relativeTime', () => {
  it('tells how long ago', () => {
    const now = 1_000_000_000;
    const ago = (seconds: number) => relativeTime(now / 1000 - seconds, now);
    expect(ago(5)).toBe('just now');
    expect(ago(60)).toBe('1 minute ago');
    expect(ago(3 * 3600)).toBe('3 hours ago');
    expect(ago(2 * 86400)).toBe('2 days ago');
    expect(ago(400 * 86400)).toBe('1 year ago');
  });
});
