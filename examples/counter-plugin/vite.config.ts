import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

import { nanoforgeEditorPlugin } from '@nanoforge-dev/editor-vite-plugin';

// Builds dist/: index.js, counter.css and the manifest. The editor loads that folder.
export default defineConfig({
  plugins: [svelte(), nanoforgeEditorPlugin()],
  build: {
    lib: { entry: { index: 'src/index.ts' }, formats: ['es'], cssFileName: 'counter' },
  },
});
