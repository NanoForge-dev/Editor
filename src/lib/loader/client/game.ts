import { gameProps } from '$lib/loader/client/game.svelte';
import type { IGameOptions } from '$lib/loader/client/types/game.type';

import { EventEmitter } from '@utils-client/event-emitter';

export const coreEvents = new EventEmitter();
export const editorEvents = new EventEmitter();

export const runGame = (canvas: HTMLCanvasElement) => {
  if (!gameProps.mainModule) throw new Error('Could not find main function');

  const gameOptions: IGameOptions = {
    files: gameProps.files,
    env: gameProps.env,
    editor: {
      save: gameProps.save,
      coreEvents: coreEvents,
      editorEvents: editorEvents,
    },
    canvas,
  };
  gameProps.mainModule.main(gameOptions);
};
