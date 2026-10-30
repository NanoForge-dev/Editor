import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MoveGuard } from '../../src/widgets/move-guard';

describe('MoveGuard', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is busy from a move until it is done', () => {
    const guard = new MoveGuard();
    expect(guard.busy).toBe(false);
    guard.start();
    expect(guard.busy).toBe(true);
    guard.done();
    expect(guard.busy).toBe(false);
  });

  it('lets the next move go after the timeout', () => {
    const guard = new MoveGuard(2000);
    guard.start();
    vi.advanceTimersByTime(1999);
    expect(guard.busy).toBe(true);
    vi.advanceTimersByTime(1);
    expect(guard.busy).toBe(false);
  });
});
