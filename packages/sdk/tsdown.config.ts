import { defineConfig } from 'tsdown';

/**
 * JavaScript of the published SDK (types are built by scripts/build-types.ts). At runtime plugins
 * never load it: the editor provides the SDK as a shared module.
 */
export default defineConfig({
  entry: ['src/index.ts', 'src/worker.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2023',
  dts: false,
  sourcemap: true,
  clean: true,
  fixedExtension: false,
  deps: {
    alwaysBundle: [/^@nanoforge-dev\/editor-(code|history|kernel|project|protocol|rpc|settings)$/],
    neverBundle: ['semver', 'zod', 'ts-morph'],
  },
});
