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
    config: () => ({
      base: './',
      build: {
        target: 'esnext',
        lib: {
          entry: options.entries ?? { index: 'src/index.ts' },
          formats: ['es'],
        },
        rollupOptions: {
          external: (id: string) => isHostModule(id),
        },
      },
    }),
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
