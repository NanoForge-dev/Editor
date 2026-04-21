import type { Save } from '$lib/loader/client/types/save.type';
import type { EditorComponentManifest } from '@nanoforge-dev/ecs-lib';
import { SvelteMap } from 'svelte/reactivity';
import { type Writable, writable } from 'svelte/store';

export const mainModule: Writable<any> = writable(undefined);
export const env: Writable<Record<string, string>> = writable({});
export const files: Writable<Map<string, string>> = writable(new SvelteMap());
export const save: Writable<Save> = writable({
  libraries: [],
  entities: [],
  components: [],
  systems: [],
});
export const componentsManifests: Writable<EditorComponentManifest[]> = writable([]);
