import { type Writable, writable } from 'svelte/store';

import type { SaveEntity } from '@utils/types';

export const selectedEntityId: Writable<string> = writable<string>('');
export const selectedEntity: Writable<SaveEntity | undefined> = writable<SaveEntity | undefined>();
