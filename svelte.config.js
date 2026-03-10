import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: [vitePreprocess()],
  onwarn: (warning, handler) => {
    if (['css_unused_selector'].includes(warning.code)) return;
    handler(warning);
  },
  kit: {
    adapter: adapter(),
    alias: {
      '@utils/*': './src/lib/utils/*',
      '@utils-client/*': './src/lib/utils-client/*',
      '@utils-server/*': './src/lib/server/utils/*',
    },
  },
};
