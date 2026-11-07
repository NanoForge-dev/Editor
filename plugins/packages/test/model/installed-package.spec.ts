import { describe, expect, it } from 'vitest';

import { missing, plural, reasonOf, updateChoices } from '../../src/model/installed-package';

const base = { name: '@acme/shapes', version: '1.0.0', dependents: [], present: true };

describe('packages model', () => {
  it('offers the update in the range, and the latest when it is another one', () => {
    expect(updateChoices({ ...base, range: '^1.0.0' })).toEqual([]);
    expect(updateChoices({ ...base, range: '^1.0.0', wanted: '1.1.0', latest: '1.1.0' })).toEqual([
      { version: '1.1.0', latest: false, label: 'Update to 1.1.0' },
    ]);
    expect(updateChoices({ ...base, range: '^1.0.0', wanted: '1.1.0', latest: '2.0.0' })).toEqual([
      { version: '1.1.0', latest: false, label: 'Update to 1.1.0' },
      { version: '2.0.0', latest: true, label: 'Update to 2.0.0' },
    ]);
    expect(updateChoices({ ...base, dependents: ['@acme/render'], latest: '2.0.0' })).toEqual([]);
  });

  it('says why a package is there, and which are missing', () => {
    expect(reasonOf({ ...base, range: '^1.0.0' })).toBe('asked for as ^1.0.0');
    expect(reasonOf({ ...base, dependents: ['@acme/render', '@acme/ui'] })).toBe(
      'needed by @acme/render, @acme/ui',
    );
    expect(missing([base, { ...base, name: '@acme/gone', present: false }])).toHaveLength(1);
    expect([plural(1, 'package'), plural(2, 'package')]).toEqual(['1 package', '2 packages']);
  });
});
