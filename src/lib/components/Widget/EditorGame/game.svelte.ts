import type { EditorComponentManifest } from '@nanoforge-dev/ecs-lib';
import { SvelteMap } from 'svelte/reactivity';
import { type Writable, get, writable } from 'svelte/store';

import { localApi } from '$lib/components/Utils/api/api';
import type { Save } from '$lib/loader/client/types/save.type';

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

export enum GameState {
  INIT_STATE = 0,
  RELOAD_FROM_SERVER,
  RELOAD_FROM_SAVE,
  PLAY,
  PAUSE,
  STOP,
}

export async function fetchComponentsManifests(side: 'client' | 'server'): Promise<void> {
  componentsManifests.set([]);

  componentsManifests.set(
    await Promise.all(
      get(save).components.map((component) => {
        return localApi.getComponentManifest(component.path, side);
      }),
    ),
  );
}
