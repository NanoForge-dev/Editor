import type { UserConfig } from 'vite';
import { describe, expect, it } from 'vitest';

import { nanoforgeEditorPlugin } from '../../src/plugin/nanoforge-editor-plugin';

/** The config the plugin adds to a user's, under Vite 8 (Rolldown). */
const configFor = (user: UserConfig): UserConfig => {
  const hook = nanoforgeEditorPlugin().config as (
    this: { meta: { rolldownVersion: string } },
    user: UserConfig,
  ) => UserConfig;
  return hook.call({ meta: { rolldownVersion: '1.0.0' } }, user);
};

describe('nanoforgeEditorPlugin', () => {
  it("leaves the user's own entry alone, and gives one otherwise", () => {
    const own = configFor({ build: { lib: { entry: ['src/index.ts'] } } }).build!.lib;
    expect(own && own.entry).toBeUndefined();
    const given = configFor({}).build!.lib;
    expect(given && given.entry).toEqual({ index: 'src/index.ts' });
  });

  it('minifies builds, but not watch builds', () => {
    expect(configFor({}).build!.rollupOptions!.output).toEqual({ minify: true });
    expect(configFor({ build: { watch: {} } }).build!.rollupOptions!.output).toBeUndefined();
    expect(configFor({ build: { minify: false } }).build!.rollupOptions!.output).toBeUndefined();
  });
});
