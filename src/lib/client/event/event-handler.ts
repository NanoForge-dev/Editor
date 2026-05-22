import { EventEmitter } from './event-emitter';
import { type CoreEvents, type CoreEventsMap } from './events/core-events';
import { type EditorEvents, type EditorEventsMap } from './events/editor-events';
import type { ListenerType } from './types';

export class EventHandler {
  public readonly _coreEvents = new EventEmitter<CoreEvents, CoreEventsMap>();
  public readonly _editorEvents = new EventEmitter<EditorEvents, EditorEventsMap>();

  emit<K extends keyof EditorEventsMap>(event: K, ...args: EditorEventsMap[K]) {
    this._editorEvents.emitEvent(event, ...args);
  }

  on<K extends keyof CoreEventsMap>(
    event: K,
    callback: ListenerType<CoreEvents, CoreEventsMap, K>,
  ) {
    this._coreEvents.on(event, callback);
  }
}
