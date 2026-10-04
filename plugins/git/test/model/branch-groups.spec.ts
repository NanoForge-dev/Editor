import { describe, expect, it } from 'vitest';

import { branchGroups } from '../../src/model/branch-groups';

describe('branchGroups', () => {
  it('groups branches: local with the current one first, then remote', () => {
    const groups = branchGroups([
      { name: 'feature', current: false, remote: false },
      { name: 'origin/main', current: false, remote: true },
      { name: 'main', current: true, remote: false },
    ]);
    expect(groups.local.map((branch) => branch.name)).toEqual(['main', 'feature']);
    expect(groups.remote.map((branch) => branch.name)).toEqual(['origin/main']);
  });
});
