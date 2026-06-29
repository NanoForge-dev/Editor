import { get, writable } from 'svelte/store';

import { moveComponentListener } from '$lib/client/event/listeners/move-component.listener';

import { EventEmitter } from './event-emitter';
import type { CoreEvents, CoreEventsMap } from './events/core-events';
import type { EditorEvents, EditorEventsMap } from './events/editor-events';
import type { ListenerType } from './types';

const listeners = writable<(() => void)[]>([]);

export class EventHandler {
  public readonly _coreEvents = new EventEmitter<CoreEvents, CoreEventsMap>();
  public readonly _editorEvents = new EventEmitter<EditorEvents, EditorEventsMap>(true);

  static reset() {
    get(listeners).forEach((unsub) => unsub());
    listeners.set([]);
  }

  async init() {
    listeners.set([moveComponentListener(this)]);
  }

  emit<K extends keyof CoreEventsMap>(event: K, ...args: CoreEventsMap[K]) {
    this._coreEvents.emitEvent(event, ...args);
  }

  on<K extends keyof EditorEventsMap>(
    event: K,
    callback: ListenerType<EditorEvents, EditorEventsMap, K>,
  ) {
    this._editorEvents.on(event, callback);
  }
}
