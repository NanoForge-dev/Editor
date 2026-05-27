export type ListenerType<
  Events extends string,
  EventsMap extends Record<Events, unknown[]>,
  K extends keyof EventsMap,
> = (...args: EventsMap[K]) => void;

export type QueuedEvent<EventsMap, K extends keyof EventsMap = keyof EventsMap> = {
  event: K;
  args: EventsMap[K];
};

export interface IEventEmitter<Events extends string, EventsMap extends Record<Events, unknown[]>> {
  listeners: {
    [K in keyof EventsMap]?: ListenerType<Events, EventsMap, K>[];
  };

  eventQueue: QueuedEvent<EventsMap>[];

  runEvents(): void;

  emitEvent<K extends keyof EventsMap>(event: K, ...args: EventsMap[K]): void;

  addListener<K extends keyof EventsMap>(
    event: K,
    listener: ListenerType<Events, EventsMap, K>,
  ): void;

  on<K extends keyof EventsMap>(event: K, listener: ListenerType<Events, EventsMap, K>): void;

  removeListener<K extends keyof EventsMap>(
    event: K,
    listener: ListenerType<Events, EventsMap, K>,
  ): void;

  off<K extends keyof EventsMap>(event: K, listener: ListenerType<Events, EventsMap, K>): void;

  removeListenersForEvent(event: keyof EventsMap): void;

  removeAllListeners(): void;
}
