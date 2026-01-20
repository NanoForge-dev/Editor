import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import UnoCSS from '@unocss/svelte-scoped/preprocess';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: [vitePreprocess(), UnoCSS()],
  onwarn: (warning, handler) => {
    if (['css_unused_selector'].includes(warning.code)) return;
    handler(warning);
  },
  kit: {
    adapter: adapter(),
  },
};
