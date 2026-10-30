import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type KeyMove,
  NUDGE_REST_MS,
  keyNudges,
  nudgeStep,
} from '../../../src/widgets/scene/key-nudges';

const key = (
  k: string,
  mods: Partial<Record<'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey', boolean>> = {},
) => ({
  key: k,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

describe('nudgeStep', () => {
  it('moves 1 unit per arrow, 10 with Shift', () => {
    expect(nudgeStep(key('ArrowLeft'))).toEqual([-1, 0]);
    expect(nudgeStep(key('ArrowDown', { shiftKey: true }))).toEqual([0, 10]);
  });

  it('ignores other keys and arrows with Alt, Ctrl or Meta', () => {
    expect(nudgeStep(key('a'))).toBeUndefined();
    expect(nudgeStep(key('ArrowUp', { ctrlKey: true }))).toBeUndefined();
    expect(nudgeStep(key('ArrowUp', { altKey: true }))).toBeUndefined();
  });
});

describe('keyNudges', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    let pending: KeyMove | undefined;
    const commit = vi.fn();
    const nudges = keyNudges({ read: () => pending, write: (next) => (pending = next), commit });
    return { nudges, commit, pending: () => pending };
  };

  it('gathers presses in a row into one move written once the keys rest', () => {
    const { nudges, commit, pending } = setup();
    nudges.press('ball', [1, 0]);
    nudges.press('ball', [0, 10]);
    expect(pending()).toEqual({ entity: 'ball', dx: 1, dy: 10 });
    vi.advanceTimersByTime(NUDGE_REST_MS - 1);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledExactlyOnceWith({ entity: 'ball', dx: 1, dy: 10 });
    expect(pending()).toBeUndefined();
  });

  it("writes another entity's pending move before moving this one", () => {
    const { nudges, commit, pending } = setup();
    nudges.press('ball', [1, 0]);
    nudges.press('paddle', [0, -1]);
    expect(commit).toHaveBeenCalledExactlyOnceWith({ entity: 'ball', dx: 1, dy: 0 });
    expect(pending()).toEqual({ entity: 'paddle', dx: 0, dy: -1 });
  });

  it('writes at once on flush, and nothing when no move is pending', () => {
    const { nudges, commit } = setup();
    nudges.flush();
    expect(commit).not.toHaveBeenCalled();
    nudges.press('ball', [-1, 0]);
    nudges.flush();
    vi.advanceTimersByTime(NUDGE_REST_MS);
    expect(commit).toHaveBeenCalledExactlyOnceWith({ entity: 'ball', dx: -1, dy: 0 });
  });
});
