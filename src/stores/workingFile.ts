import { type Writable, writable } from 'svelte/store';

export const workingFileStore: Writable<string> = writable('');
