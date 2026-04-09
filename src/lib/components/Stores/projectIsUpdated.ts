import { type Writable, writable } from 'svelte/store';

export const projectIsUpdatedStore: Writable<boolean> = writable(false);
