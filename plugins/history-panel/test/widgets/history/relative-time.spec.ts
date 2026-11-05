import { describe, expect, it } from 'vitest';

import { relativeTime } from '../../../src/widgets/history/relative-time';

describe('relativeTime', () => {
  const now = Date.UTC(2026, 9, 13, 12);
  it('says just now, then minutes, then hours, then the date', () => {
    expect(relativeTime(now - 10_000, now)).toBe('just now');
    expect(relativeTime(now + 5_000, now)).toBe('just now');
    expect(relativeTime(now - 40_000, now)).toBe('1 min ago');
    expect(relativeTime(now - 25 * 60_000, now)).toBe('25 min ago');
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(relativeTime(now - 3 * 86_400_000, now)).toBe(
      new Date(now - 3 * 86_400_000).toLocaleDateString(),
    );
  });
});
