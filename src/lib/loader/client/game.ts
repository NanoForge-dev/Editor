import { env, files, mainModule, save } from '$lib/components/Widget/EditorGame/game.svelte';
import type { IGameOptions } from '$lib/loader/client/types/game.type';

import { EventEmitter } from '@utils-client/event-emitter';
import { get } from 'svelte/store';

export const coreEvents = new EventEmitter();
export const editorEvents = new EventEmitter();

export const runGame = (canvas: HTMLCanvasElement) => {
  if (!get(mainModule)) throw new Error('Could not find main function');

  const gameOptions: IGameOptions = {
    files: get(files),
    env: get(env),
    editor: {
      save: get(save),
      coreEvents: coreEvents,
      editorEvents: editorEvents,
    },
    canvas,
  };
  get(mainModule).main(gameOptions);
};
