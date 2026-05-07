import type { Save } from '@utils/types';

import type { IEventEmitter } from './event-emitter.type';

export interface IGameOptions {
  canvas: HTMLCanvasElement;
  files: Map<string, string>;
  env: Record<string, string | undefined>;
  editor: {
    save: Save;
    coreEvents: IEventEmitter;
    editorEvents: IEventEmitter;
  };
}
