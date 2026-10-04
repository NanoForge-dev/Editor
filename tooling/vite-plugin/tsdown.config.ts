import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  dts: true,
  sourcemap: true,
  clean: true,
  fixedExtension: false,
  deps: { alwaysBundle: ['@nanoforge-dev/editor-kernel'], neverBundle: ['semver', 'zod'] },
});
