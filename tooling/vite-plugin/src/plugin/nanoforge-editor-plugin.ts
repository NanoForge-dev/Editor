import type { Plugin } from 'vite';

import { MANIFEST_FILE, buildManifest } from '../manifest/build-manifest';
import { rewriteSharedImports } from '../rewrite/rewrite-shared-imports';
import { isHostModule } from '../shared-module/shared-modules';

export interface EditorPluginBuildOptions {
  /** Plugin entry files, relative to the plugin root. Defaults to `{ index: 'src/index.ts' }`. */
  entries?: Record<string, string>;
  /**
   * Validate `nanoforge.manifest.json` and emit it next to the bundles, with build info.
   * Defaults to true; disable for fixtures without a manifest.
   */
  manifest?: boolean;
}

/**
 * Builds a NanoForge editor plugin as ES modules that use the host's shared modules
 * (Svelte runtime, editor SDK) instead of bundling their own copy.
 */
export const nanoforgeEditorPlugin = (options: EditorPluginBuildOptions = {}): Plugin => {
  let root = process.cwd();
  return {
    name: 'nanoforge-editor-plugin',
    enforce: 'post',
    configResolved(config) {
      root = config.root;
    },
    config(user) {
      const lib = user.build?.lib || undefined;
      /** Vite 8 (Rolldown) can minify library output fully; library mode keeps whitespace. */
      const rolldown = 'rolldownVersion' in this.meta;
      return {
        base: './',
        build: {
          target: 'esnext',
          lib: {
            /**
             * Arrays are merged with the plugin's own config: `['es']` twice built it twice. The
             * user's own `entry` and `formats` are left to them for the same reason.
             */
            ...(!lib?.entry && { entry: options.entries ?? { index: 'src/index.ts' } }),
            ...(!lib?.formats && { formats: ['es'] }),
          },
          rollupOptions: {
            external: (id: string) => isHostModule(id),
            /** Watch builds (dev plugins) stay readable: their stack traces point at real lines. */
            ...(rolldown &&
              user.build?.minify !== false &&
              !user.build?.watch && { output: { minify: true } }),
          },
        },
      };
    },
    async renderChunk(code) {
      const result = await rewriteSharedImports(code);
      return result === null ? null : { code: result, map: null };
    },
    generateBundle() {
      if (options.manifest === false) return;
      this.emitFile({
        type: 'asset',
        fileName: MANIFEST_FILE,
        source: `${JSON.stringify(buildManifest(root), null, 2)}\n`,
      });
    },
  };
};
