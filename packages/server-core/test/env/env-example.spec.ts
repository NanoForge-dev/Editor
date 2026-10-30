import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { envExample } from '../../scripts/env-example';

describe('.env.example', () => {
  it('is up to date (run `pnpm generate:env` in packages/server-core)', () => {
    const file = new URL('../../../../.env.example', import.meta.url);
    expect(readFileSync(file, 'utf8')).toBe(envExample());
  });
});
