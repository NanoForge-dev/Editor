import { error } from '@sveltejs/kit';

import { dev } from '$app/environment';

/**
 * The kit playground is for development: a production build has no `/kit`, and no playground
 * code (the import sits in a branch the build drops).
 */
export const load = async () => {
  if (dev) return { KitPlayground: (await import('$lib/kit/KitPlayground.svelte')).default };
  error(404, 'Not found');
};
