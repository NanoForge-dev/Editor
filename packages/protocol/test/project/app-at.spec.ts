import { describe, expect, it } from 'vitest';

import { appAt } from '../../src/project/app-at';

describe('appAt', () => {
  const apps = [{ root: 'apps/client' }, { root: 'apps/client-tools' }, { root: 'libs/shared' }];

  it('finds the app whose root holds the path, not one that only starts like it', () => {
    expect(appAt(apps, 'apps/client')).toBe(apps[0]);
    expect(appAt(apps, 'apps/client/src/components')).toBe(apps[0]);
    expect(appAt(apps, 'apps/client-tools/src')).toBe(apps[1]);
    expect(appAt(apps, 'apps')).toBeUndefined();
  });

  it('takes the deepest root, a single-app project holding every path', () => {
    const single = [{ root: '' }, { root: 'tools' }];
    expect(appAt(single, 'src/main.ts')).toBe(single[0]);
    expect(appAt(single, 'tools/x.ts')).toBe(single[1]);
  });
});
