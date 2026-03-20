import { type Writable, writable } from 'svelte/store';

export const ContentBrowserPath: Writable<string[]> = writable([]);
