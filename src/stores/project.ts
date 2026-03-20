import { type Writable, writable } from 'svelte/store';

export const projectPathStore: Writable<string> = writable('');
