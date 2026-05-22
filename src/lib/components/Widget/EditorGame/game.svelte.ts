import { SvelteMap } from 'svelte/reactivity';
import { type Writable, writable } from 'svelte/store';

import type { Save } from '@utils/types';

export const mainModule: Writable<any> = writable(undefined);
export const env: Writable<Record<string, string>> = writable({});
export const files: Writable<Map<string, string>> = writable(new SvelteMap());
export const save: Writable<Save> = writable({
  libraries: [],
  entities: [],
  components: [],
  systems: [],
});

export enum GameState {
  INIT_STATE = 0,
  RELOAD_FROM_SERVER,
  RELOAD_FROM_SAVE,
  PLAY,
  PAUSE,
  STOP,
}
