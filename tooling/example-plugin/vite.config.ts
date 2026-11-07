import { defineConfig } from 'vite';

import { nanoforgeEditorPlugin } from '@nanoforge-dev/editor-vite-plugin';

export default defineConfig({
  plugins: [nanoforgeEditorPlugin()],
});
