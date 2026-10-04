/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { pluginManifestJsonSchema } from '../../src/plugin/plugin-manifest';

describe('plugin JSON schema', () => {
  it('is up to date (run `pnpm generate:schema` in packages/kernel)', () => {
    const file = new URL('../../schemas/plugin.schema.json', import.meta.url);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(pluginManifestJsonSchema());
  });
});
