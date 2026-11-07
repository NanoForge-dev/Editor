import { describe, expect, it } from 'vitest';

import { branchLabel } from '../../src/model/branch-label';
import { status } from '../fixtures/status';

describe('branchLabel', () => {
  it('labels the branch with what is ahead and behind', () => {
    expect(branchLabel(status())).toBe('main');
    expect(branchLabel(status({ ahead: 2, behind: 1 }))).toBe('main ↑2 ↓1');
    expect(branchLabel(status({ behind: 3 }))).toBe('main ↓3');
    expect(branchLabel(status({ branch: undefined }))).toBe('detached at abc1234');
    expect(branchLabel({ ...status(), repository: false })).toBe('');
    expect(branchLabel(undefined)).toBe('');
  });
});
