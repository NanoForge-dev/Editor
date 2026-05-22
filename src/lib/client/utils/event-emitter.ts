import type { EventEnumMap, IEventEmitter, ListenerType, QueuedEvent } from '$lib/client/loader';

export class EventEmitter implements IEventEmitter {
  public listeners: {
    [K in keyof EventEnumMap]?: ListenerType<K>[];
  } = {};

  public eventQueue: QueuedEvent[] = [];

  runEvents(): void {
    this.eventQueue.forEach((e) => {
      this._executeEvent(e);
    });

    this.eventQueue = [];
  }

  emitEvent<K extends keyof EventEnumMap>(event: K, ...args: EventEnumMap[K]): void {
    this.eventQueue.push({
      event,
      args,
    });
  }
  addListener<K extends keyof EventEnumMap>(event: K, listener: ListenerType<K>): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
  }
  on<K extends keyof EventEnumMap>(event: K, listener: ListenerType<K>): void {
    this.addListener(event, listener);
  }

  removeListener<K extends keyof EventEnumMap>(event: K, listener: ListenerType<K>): void {
    if (!this.listeners[event]) return;
    const index = this.listeners[event].indexOf(listener);
    if (index >= 0) {
      this.listeners[event].splice(index, 1);
    }
  }
  off<K extends keyof EventEnumMap>(event: K, listener: ListenerType<K>): void {
    this.removeListener(event, listener);
  }

  removeListenersForEvent(event: keyof EventEnumMap): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = [];
  }
  removeAllListeners(): void {
    this.listeners = {};
  }

  private _executeEvent<K extends keyof EventEnumMap>({ event, args }: QueuedEvent<K>): void {
    this.listeners[event]?.forEach((listener) => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error handling event [${String(event)}]:`, error);
      }
    });
  }
}
