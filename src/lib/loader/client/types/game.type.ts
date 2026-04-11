import type { IEventEmitter } from './event-emitter.type';
import type { Save } from './save.type';

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
