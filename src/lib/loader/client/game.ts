import type { IGameOptions } from '$lib/loader/client/types/game.type';
import type { Save } from '$lib/loader/client/types/save.type';
import { EventEmitter } from '@utils-client/event-emitter';

export const coreEvents = new EventEmitter();
export const editorEvents = new EventEmitter();

export const gameProps: {
  mainModule: any;
  env: Record<string, string>;
  files: Map<string, string>;
  save: Save;
} = {
  mainModule: undefined,
  env: {},
  files: new Map(),
  save: {
    libraries: [],
    entities: [],
    components: [],
    systems: [],
  },
};

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
