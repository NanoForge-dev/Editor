import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

import { nanoforgeEditorPlugin } from '@nanoforge-dev/editor-vite-plugin';

export default defineConfig({
  plugins: [svelte(), nanoforgeEditorPlugin()],
  build: {
    lib: {
      entry: { index: 'src/index.ts', worker: 'src/worker/index.ts' },
      formats: ['es'],
      cssFileName: 'scene',
    },
  },
});
