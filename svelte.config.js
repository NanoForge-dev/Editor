import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import UnoCSS from '@unocss/svelte-scoped/preprocess';

export default {
  preprocess: [vitePreprocess(), UnoCSS()],
  onwarn: (warning, handler) => {
    if (['css_unused_selector'].includes(warning.code)) return;
    handler(warning);
  },
};
