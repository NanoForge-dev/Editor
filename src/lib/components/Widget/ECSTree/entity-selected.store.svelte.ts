import { type Writable, writable } from 'svelte/store';

export const selectedEntityId: Writable<string> = writable<string>('');
