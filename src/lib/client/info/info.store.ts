import { writable } from 'svelte/store';

import type { ProjectInfo } from './info.type';

export const infoStore = writable<ProjectInfo | null>();
