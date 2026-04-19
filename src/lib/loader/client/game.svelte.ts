import type { Save } from '$lib/loader/client/types/save.type';
import type { EditorComponentManifest } from '@nanoforge-dev/ecs-lib';
import { SvelteMap } from 'svelte/reactivity';

export const gameProps: {
  mainModule: any;
  env: Record<string, string>;
  files: Map<string, string>;
  save: Save;
} = $state({
  mainModule: undefined,
  env: {},
  files: new SvelteMap(),
  save: {
    libraries: [],
    entities: [],
    components: [],
    systems: [],
  },
});

export const componentsManifests: EditorComponentManifest[] = $state([]);
