import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from 'svelte-adapter-bun';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: [vitePreprocess()],
  onwarn: (warning, handler) => {
    if (['css_unused_selector'].includes(warning.code)) return;
    handler(warning);
  },
  kit: {
    adapter: adapter({
      out: 'dist',
    }),
    alias: {
      '@utils/*': './src/lib/utils/*',
      '@utils-client/*': './src/lib/client/utils/*',
      '@utils-server/*': './src/lib/server/utils/*',
    },
    files: {
      assets: 'public',
    },
  },
};
